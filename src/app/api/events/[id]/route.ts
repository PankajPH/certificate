
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import { z } from "zod";

import { connectDB } from "@/lib/mongodb";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import Event from "@/models/Event";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const updateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  venue: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  organizer: z.string().trim().max(150).optional().default(""),
  status: z.enum(["draft", "published", "archived"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function detectImageMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(buffer.toString("ascii", 8, 12))
  ) {
    return "image/avif";
  }

  return null;
}

async function uploadEventImage(file: File) {
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Event image must be between 1 byte and 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMime(buffer);

  if (
    !detectedMime ||
    !ALLOWED_IMAGE_TYPES.includes(
      detectedMime as (typeof ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    throw new Error("Unsupported image. Upload PNG, JPG, WEBP, GIF or AVIF.");
  }

  if (file.type && file.type !== detectedMime) {
    throw new Error("The uploaded image file type does not match its content.");
  }

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB connection is not available.");
  }

  const bucket = new GridFSBucket(db, {
    bucketName: "eventImages",
  });

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const uploadStream = bucket.openUploadStream(safeFileName, {
  metadata: {
    contentType: detectedMime,
    originalName: file.name,
    purpose: "event-image",
  },
});

  await new Promise<void>((resolve, reject) => {
    uploadStream.once("finish", resolve);
    uploadStream.once("error", reject);

    Readable.from(buffer).pipe(uploadStream);
  });

  return {
    fileId: uploadStream.id as mongoose.Types.ObjectId,
    fileName: safeFileName,
    mimeType: detectedMime,
    fileSize: buffer.length,
  };
}

async function deleteEventImage(
  fileId: mongoose.Types.ObjectId | null | undefined
) {
  if (!fileId) return;

  const db = mongoose.connection.db;

  if (!db) return;

  const bucket = new GridFSBucket(db, {
    bucketName: "eventImages",
  });

  try {
    await bucket.delete(fileId);
  } catch (error) {
    console.error("Event image deletion error:", error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid event ID." },
        { status: 400 }
      );
    }

    await connectDB();

    const event = await Event.findById(id).lean();

    if (!event) {
      return NextResponse.json(
        { success: false, message: "Event not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        _id: event._id.toString(),
        createdBy: event.createdBy.toString(),
        imageFileId: event.imageFileId?.toString() || null,
      },
    });
  } catch (error) {
    console.error("Get event error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load event." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  let newlyUploadedImageId: mongoose.Types.ObjectId | null = null;

  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid event ID." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const rawData = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      venue: formData.get("venue"),
      city: formData.get("city"),
      organizer: formData.get("organizer") ?? "",
      status: formData.get("status"),
    };

    const parsed = updateSchema.safeParse(rawData);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check the event details.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      return NextResponse.json(
        { success: false, message: "Please provide valid event dates." },
        { status: 400 }
      );
    }

    const imageEntry = formData.get("image");
    const removeImage = formData.get("removeImage") === "true";

    if (imageEntry !== null && !(imageEntry instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Invalid event image." },
        { status: 400 }
      );
    }

    if (removeImage && imageEntry instanceof File && imageEntry.size > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose either a new image or remove the current image.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const currentEvent = await Event.findById(id);

    if (!currentEvent) {
      return NextResponse.json(
        { success: false, message: "Event not found." },
        { status: 404 }
      );
    }

    const duplicate = await Event.findOne({
      slug: data.slug,
      _id: { $ne: id },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "This event URL is already in use." },
        { status: 409 }
      );
    }

    const previousImageId = currentEvent.imageFileId;

    const updateData: Record<string, unknown> = {
      ...data,
      startDate,
      endDate,
    };

    if (removeImage) {
      updateData.imageFileId = null;
      updateData.imageFileName = "";
      updateData.imageMimeType = "";
      updateData.imageFileSize = 0;
    } else if (imageEntry instanceof File && imageEntry.size > 0) {
      const uploaded = await uploadEventImage(imageEntry);

      newlyUploadedImageId = uploaded.fileId;

      updateData.imageFileId = uploaded.fileId;
      updateData.imageFileName = uploaded.fileName;
      updateData.imageMimeType = uploaded.mimeType;
      updateData.imageFileSize = uploaded.fileSize;
    }

    const event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!event) {
      throw new Error("Event not found while saving changes.");
    }

    if (
      previousImageId &&
      (removeImage || newlyUploadedImageId)
    ) {
      await deleteEventImage(previousImageId);
    }

    return NextResponse.json({
      success: true,
      message: "Event updated successfully.",
      event: {
        ...event,
        _id: event._id.toString(),
        createdBy: event.createdBy.toString(),
        imageFileId: event.imageFileId?.toString() || null,
      },
    });
  } catch (error) {
    console.error("Update event error:", error);

    if (newlyUploadedImageId) {
      await deleteEventImage(newlyUploadedImageId);
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update event.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    if (admin.role !== "superadmin") {
      return NextResponse.json(
        {
          success: false,
          message: "Only a superadmin can delete events.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid event ID." },
        { status: 400 }
      );
    }

    await connectDB();

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return NextResponse.json(
        { success: false, message: "Event not found." },
        { status: 404 }
      );
    }

    await deleteEventImage(event.imageFileId);

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete event." },
      { status: 500 }
    );
  }
}
