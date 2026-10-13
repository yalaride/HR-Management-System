import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getAdminUser } from "@/lib/auth";
import {
  HRPolicy,
  defaultHRPolicySections,
  POLICY_CATEGORIES,
  POLICY_PRIORITIES,
  PolicyCategory,
  PolicyPriority,
} from "@/modals/HRPolicy";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 }), admin: null };
  }
  return { error: null, admin };
}

export async function GET() {
  const { error: denied } = await requireAdmin();
  if (denied) return denied;

  try {
    await connectDB();
    let policy = await HRPolicy.findOne({ key: "default" }).lean();
    if (!policy) {
      policy = await HRPolicy.create({
        key: "default",
        sections: defaultHRPolicySections,
      });
    }
    return NextResponse.json(policy);
  } catch (error) {
    console.error("HR policy GET error:", error);
    return NextResponse.json({ error: "Failed to load HR policy." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { error: denied, admin } = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    if (!Array.isArray(body.sections)) {
      return NextResponse.json({ error: "Policy sections must be an array." }, { status: 400 });
    }

    const sections = body.sections.map((section: Record<string, unknown>, index: number) => {
      const category = String(section.category || "general").toLowerCase() as PolicyCategory;
      const priority = String(section.priority || "standard").toLowerCase() as PolicyPriority;

      return {
        number: Number(section.number) || index + 1,
        title: String(section.title || "").trim(),
        category: POLICY_CATEGORIES.includes(category) ? category : "general",
        priority: POLICY_PRIORITIES.includes(priority) ? priority : "standard",
        summary: String(section.summary || "").trim(),
        content: String(section.content || "").trim(),
        order: Number(section.order) || index + 1,
        published: section.published !== false,
        requiresAcknowledgement: Boolean(section.requiresAcknowledgement),
      };
    });

    if (sections.some((section: { title: string; content: string }) => !section.title || !section.content)) {
      return NextResponse.json(
        { error: "Every policy section must have at least a Title and Content clause." },
        { status: 400 }
      );
    }

    await connectDB();

    const updateDoc: Record<string, unknown> = {
      sections,
    };

    if (admin) {
      updateDoc.lastUpdatedBy = {
        id: (admin as { id?: string; _id?: string }).id || (admin as { _id?: string })._id,
        name: (admin as { name?: string }).name || "Admin",
        email: (admin as { email?: string }).email || "",
      };
    }

    const policy = await HRPolicy.findOneAndUpdate(
      { key: "default" },
      { $set: updateDoc },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return NextResponse.json(policy);
  } catch (error) {
    console.error("HR policy PUT error:", error);
    return NextResponse.json({ error: "Failed to save HR policy." }, { status: 500 });
  }
}