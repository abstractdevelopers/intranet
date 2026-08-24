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

const MONTHLY_PRICE_NGN = 15_000;

async function main() {
  for (const course of COURSES) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: {
        name: course.name,
        description: course.description,
        type: course.type,
        isCompulsory: course.isCompulsory,
        price: MONTHLY_PRICE_NGN,
        currency: "NGN",
        isActive: true,
        status: "PUBLISHED",
      },
      create: {
        ...course,
        price: MONTHLY_PRICE_NGN,
        currency: "NGN",
        status: "PUBLISHED",
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ucasandbox.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "FOUNDER" },
    create: {
      email: adminEmail,
      passwordHash,
      role: "FOUNDER",
      emailVerifiedAt: new Date(),
      profile: {
        create: { fullName: "UCA Founder" },
      },
    },
  });

  console.log("Seed complete:");
  console.log(`  Courses: ${COURSES.length} (₦${MONTHLY_PRICE_NGN.toLocaleString()}/month each)`);
  console.log(`  Founder account: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
