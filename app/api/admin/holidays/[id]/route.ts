import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import connectDB from "@/lib/mongodb";
import { getAdminUser } from "@/lib/auth";
import { Holiday } from "@/modals/Holiday";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
    }
    await connectDB();
    const deleted = await Holiday.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete holiday error:", error);
    return NextResponse.json({ error: "Failed to delete the holiday" }, { status: 500 });
  }
}
