import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COURSES = [
  {
    name: "Personal Branding",
    slug: "personal-branding",
    description:
      "Build a compelling personal brand that communicates your value, story, and expertise.",
    type: "COMPULSORY",
    isCompulsory: true,
  },
  {
    name: "Social Media",
    slug: "social-media",
    description:
      "Master social media strategy, growth, and audience engagement across platforms.",
    type: "COMPULSORY",
    isCompulsory: true,
  },
  {
    name: "Video Editing",
    slug: "video-editing",
    description: "Learn professional video editing and production.",
    type: "ELECTIVE",
    isCompulsory: false,
  },
  {
    name: "Graphics Design",
    slug: "graphics-design",
    description: "Learn visual communication and graphic design.",
    type: "ELECTIVE",
    isCompulsory: false,
  },
  {
    name: "Communication / Influence",
    slug: "communication-influence",
    description:
      "Develop communication, confidence, persuasion and influence skills.",
    type: "ELECTIVE",
    isCompulsory: false,
  },
  {
    name: "Content Writing",
    slug: "content-writing",
    description: "Develop professional writing and content creation skills.",
    type: "ELECTIVE",
    isCompulsory: false,
  },
] as const;

// Only the elective is billed; the two compulsory foundations are free. The
// monthly total is therefore derived from the elective's price, never hardcoded.
const ELECTIVE_MONTHLY_PRICE_NGN = 15_000;
const COMPULSORY_MONTHLY_PRICE_NGN = 0;

/**
 * WhatsApp campuses. The general community has no pathway and is visible to
 * every student; each campus is visible only to students whose elective was
 * accepted for that pathway. Names match the campuses as the academy refers
 * to them.
 */
const COMMUNITIES = [
  {
    name: "General UCA Community",
    description: "The academy-wide community — open to every UCA student.",
    platform: "WHATSAPP",
    url: "https://chat.whatsapp.com/COdoshnfo9EAV7Ndp3mDbm",
    pathway: null,
    order: 0,
  },
  {
    name: "Graphic Design Campus",
    description: "For students on the Graphics Design pathway.",
    platform: "WHATSAPP",
    url: "https://chat.whatsapp.com/EHdM94vPC3VErr0ufDW2rD",
    pathway: "GRAPHIC_DESIGN",
    order: 1,
  },
  {
    name: "Video Editing Campus",
    description: "For students on the Video Editing pathway.",
    platform: "WHATSAPP",
    url: "https://chat.whatsapp.com/EnUIjX2Tsnp1UGRAheDc43",
    pathway: "VIDEO_EDITING",
    order: 2,
  },
  {
    name: "Communication & Influence Campus",
    description: "For students on the Communication & Influence pathway.",
    platform: "WHATSAPP",
    url: "https://chat.whatsapp.com/DCjBHc6iUgs2wKtKtyN1t5",
    pathway: "COMMUNICATION_INFLUENCE",
    order: 3,
  },
  {
    name: "Content Writing Campus",
    description: "For students on the Content Writing pathway.",
    platform: "WHATSAPP",
    url: "https://chat.whatsapp.com/GDS2W0bKatKCNyF3uaOOPO",
    pathway: "CONTENT_WRITING",
    order: 4,
  },
];

async function main() {
  for (const course of COURSES) {
    const price =
      course.type === "COMPULSORY" ? COMPULSORY_MONTHLY_PRICE_NGN : ELECTIVE_MONTHLY_PRICE_NGN;
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: {
        name: course.name,
        description: course.description,
        type: course.type,
        isCompulsory: course.isCompulsory,
        price,
        currency: "NGN",
        isActive: true,
        status: "PUBLISHED",
      },
      create: {
        ...course,
        price,
        currency: "NGN",
        status: "PUBLISHED",
      },
    });
  }

  const adminEmails = (
    process.env.SEED_ADMIN_EMAILS ??
    process.env.SEED_ADMIN_EMAIL ??
    "admin@ucasandbox.com"
  )
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  for (const email of adminEmails) {
    const name = email
      .split("@")[0]
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    await prisma.user.upsert({
      where: { email },
      update: { role: "FOUNDER" },
      create: {
        email,
        passwordHash,
        role: "FOUNDER",
        emailVerifiedAt: new Date(),
        profile: {
          create: { fullName: name },
        },
      },
    });
  }

  // Communities are keyed by name+pathway: there is no unique constraint, and
  // upserting on name alone would let a duplicate row stack up on each run.
  let communityCount = 0;
  for (const community of COMMUNITIES) {
    const existing = await prisma.community.findFirst({
      where: { name: community.name, pathway: community.pathway },
      select: { id: true },
    });
    if (existing) {
      await prisma.community.update({ where: { id: existing.id }, data: community });
    } else {
      await prisma.community.create({ data: community });
    }
    communityCount++;
  }

  console.log("Seed complete:");
  console.log(
    `  Courses: ${COURSES.length} (compulsory ₦${COMPULSORY_MONTHLY_PRICE_NGN.toLocaleString()}, elective ₦${ELECTIVE_MONTHLY_PRICE_NGN.toLocaleString()}/month)`
  );
  console.log(`  Founder accounts: ${adminEmails.join(", ")}`);
  console.log(`  Communities: ${communityCount} (1 general + ${communityCount - 1} pathway campuses)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
