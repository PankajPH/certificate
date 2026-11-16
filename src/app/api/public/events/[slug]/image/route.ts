
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Event from "@/models/Event";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { slug } = await params;

    await connectDB();

    const event = await Event.findOne({
      slug: slug.toLowerCase(),
      status: "published",
    })
      .select("imageFileId imageMimeType imageFileName imageFileSize")
      .lean();

    if (!event || !event.imageFileId) {
      return NextResponse.json(
        { success: false, message: "Event image not found." },
        { status: 404 }
      );
    }

    if (
      !event.imageMimeType ||
      !ALLOWED_IMAGE_TYPES.includes(event.imageMimeType)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid event image type." },
        { status: 415 }
      );
    }

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection is not available.");
    }

    const bucket = new GridFSBucket(db, {
      bucketName: "eventImages",
    });

    const downloadStream = bucket.openDownloadStream(event.imageFileId);

    const webStream = Readable.toWeb(
      downloadStream
    ) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": event.imageMimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Public event image error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load event image." },
      { status: 500 }
    );
  }
}
