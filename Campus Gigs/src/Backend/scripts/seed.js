
// =============================================================================

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Imports all models so Mongoose registers them before we use them
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

const TEST_PASSWORD = "Password123!";

const seedUsers = [
  {
    name: "Chidi Okeke",
    email: "chidi@test.com",
    studentId: "20220001",
    role: "freelancer",
    university: "University of Lagos",
    bio: "Frontend developer and UI/UX designer with 2 years of freelance experience. Specialise in building clean, responsive web apps.",
    skills: ["HTML/CSS", "JavaScript", "React", "Figma", "UI/UX Design"],
    rating: 4.8,
    ratingCount: 12,
    completedJobs: 15,
  },
  {
    name: "Amina Bello",
    email: "amina@test.com",
    studentId: "20220002",
    role: "freelancer",
    university: "Ahmadu Bello University",
    bio: "Content writer and social media strategist. I help brands tell compelling stories that convert readers into customers.",
    skills: ["Copywriting", "SEO", "Social Media", "Blog Writing", "Email Marketing"],
    rating: 4.6,
    ratingCount: 8,
    completedJobs: 10,
  },
  {
    name: "Emeka Nwosu",
    email: "emeka@test.com",
    studentId: "20220003",
    role: "client",
    university: "University of Nigeria, Nsukka",
    bio: "Student entrepreneur running a small events business. Always looking for talented students to collaborate with.",
    skills: [],
    rating: 0,
    ratingCount: 0,
    completedJobs: 0,
  },
  {
    name: "Fatima Aliyu",
    email: "fatima@test.com",
    studentId: "20220004",
    role: "client",
    university: "Bayero University Kano",
    bio: "Final year student building a tech startup. Need help with branding, content, and development.",
    skills: [],
    rating: 0,
    ratingCount: 0,
    completedJobs: 0,
  },
];

async function seed() {
  console.log("💱 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.");

  console.log("\n🛑 Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    Contract.deleteMany({}),
    Transaction.deleteMany({}),
    Notification.deleteMany({}),
    Message.deleteMany({}),
  ]);
  console.log("   Done.");

  console.log("\n🧵 Creating users...");
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
  const usersWithPasswords = seedUsers.map((u) => ({
    ...u,
    password: hashedPassword,
    isVerified: true,
  }));

  const users = await User.insertMany(usersWithPasswords);
  const [chidi, amina, emeka, fatima] = users;

  console.log(`   Created ${users.length} users.`);
  console.log(`   Password for all: ${TEST_PASSWORD}`);

  console.log("\n📦 Creating jobs...");
  const landingDeadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const transcribeDeadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const jobs = await Job.insertMany([
    {
      title: "Design a Logo and Brand Identity for My Events Business",
      description:
        "I run a small events management company targeting university students. I need a professional logo, colour palette, and basic brand guidelines. The brand should feel modern, energetic, and youthful. Please share your portfolio in your proposal.",
      category: "Design & Creative",
      skills: ["Logo Design", "Branding", "Illustrator", "Figma"],
      budget: 2500000,
      deliveryDays: 7,
      postedBy: emeka._id,
      status: "open",
      isUrgent: true,
    },
    {
      title: "Write 10 SEO Blog Posts for a Health & Wellness Website",
      description:
        "We are launching a health and wellness blog targeting Nigerian university students. We need 10 well-researched, SEO-optimised articles of 800-1000 words each. Topics will be provided. Must be original and plagiarism-free.",
      category: "Writing & Content",
      skills: ["SEO Writing", "Blog Writing", "Research", "Health Content"],
      budget: 3000000,
      deliveryDays: 14,
      postedBy: fatima._id,
      status: "open",
    },
    {
      title: "Build a Landing Page for My Mobile App Startup",
      description:
        "I need a responsive landing page for my fintech startup. The page should include a hero section, feature highlights, testimonials, and a waitlist signup form. Should be built with HTML, CSS, and JavaScript — no frameworks needed.",
      category: "Programming & Tech",
      skills: ["HTML/CSS", "JavaScript", "Responsive Design", "UI/UX"],
      budget: 5000000,
      deliveryDays: 10,
      postedBy: fatima._id,
      status: "in_progress",
      assignedTo: chidi._id,
    },
    {
      title: "Manage Our Instagram and Twitter for 1 Month",
      description:
        "Looking for a social media manager to handle our campus event brand's Instagram and Twitter accounts for 30 days. Deliverables: 3 posts/week per platform, story updates, and a monthly analytics report.",
      category: "Marketing & Social Media",
      skills: ["Social Media", "Content Creation", "Canva", "Analytics"],
      budget: 1500000,
      deliveryDays: 30,
      postedBy: emeka._id,
      status: "open",
    },
    {
      title: "Transcribe and Edit 5 Hours of Interview Audio",
      description:
        "I have 5 hours of recorded interviews for my final year research project. I need them accurately transcribed into Word documents and lightly edited for readability. Turnaround needed within 5 days.",
      category: "Admin & Virtual Assistant",
      skills: ["Transcription", "Typing", "Microsoft Word", "Research"],
      budget: 800000,
      deliveryDays: 5,
      postedBy: fatima._id,
      status: "completed",
      assignedTo: amina._id,
    },
    {
      title: "Create a 60-Second Promo Video for Our Student Association",
      description:
        "We need a short, engaging promo video for our faculty student association. You will be provided with raw footage and photos. Deliverable: edited video with background music, text overlays, and transitions.",
      category: "Video & Animation",
      skills: ["Video Editing", "Premiere Pro", "After Effects", "Motion Graphics"],
      budget: 4000000,
      deliveryDays: 7,
      postedBy: emeka._id,
      status: "open",
    },
  ]);

  const [logoJob, blogJob, landingPageJob, , transcribeJob] = jobs;

  console.log("\n🧾 Creating applications...");
  const applications = await Application.insertMany([
    {
      job: logoJob._id,
      applicant: chidi._id,
      coverLetter:
        "Hi! I'm Chidi, a UI/UX designer and frontend developer based in Lagos. I have designed over 20 logos for student-run businesses across UNILAG. I understand how to create a brand that resonates with a young, energetic audience. I would love to bring your vision to life. Please check my portfolio at dribbble.com/chidi (example). I can deliver within 5 days.",
      bidAmount: 2000000,
      deliveryDays: 5,
      status: "pending",
    },
    {
      job: logoJob._id,
      applicant: amina._id,
      coverLetter:
        "Hello! While my primary skill is writing, I also have strong Canva and basic branding experience from my time running our faculty's social media. I can deliver a clean logo and brand guide. I am willing to work at a competitive rate.",
      bidAmount: 1800000,
      deliveryDays: 7,
      status: "pending",
    },
    {
      job: landingPageJob._id,
      applicant: chidi._id,
      coverLetter:
        "I specialise in building fast, responsive landing pages. I have built 8 landing pages for Nigerian startups this year alone. My process: gather requirements → wireframe → build → revise. I can deliver a pixel-perfect result in 8 days.",
      bidAmount: 4500000,
      deliveryDays: 8,
      status: "accepted",
    },
    {
      job: transcribeJob._id,
      applicant: amina._id,
      coverLetter:
        "Transcription is one of my core services. I type at 80 WPM with very high accuracy. I have transcribed academic interviews before and understand the importance of precision for research work. I will deliver all 5 hours within 4 days.",
      bidAmount: 750000,
      deliveryDays: 4,
      status: "accepted",
    },
  ]);

  const [ , , landingApp, transcribeApp] = applications;

  console.log("\n📝 Creating contracts...");
  const contracts = await Contract.insertMany([
    {
      job: landingPageJob._id,
      application: landingApp._id,
      client: fatima._id,
      freelancer: chidi._id,
      agreedAmount: 4500000,
      deadline: landingDeadline,
      status: "active",
      clientSignedAt: new Date(),
      freelancerSignedAt: new Date(),
    },
    {
      job: transcribeJob._id,
      application: transcribeApp._id,
      client: fatima._id,
      freelancer: amina._id,
      agreedAmount: 750000,
      deadline: transcribeDeadline,
      status: "completed",
      deliverableNote:
        "All 5 interviews have been transcribed and saved as separate Word documents. Light editing applied for readability.",
      clientSignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      freelancerSignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [landingContract, transcribeContract] = contracts;

  console.log("\n💳 Creating transactions...");
  await Transaction.insertMany([
    {
      user: fatima._id,
      type: "escrow_in",
      amount: 4500000,
      currency: "NGN",
      description: "Escrow for contract: Landing Page — Fatima's Startup",
      status: "completed",
      relatedContract: landingContract._id,
    },
    {
      user: fatima._id,
      type: "escrow_in",
      amount: 750000,
      currency: "NGN",
      description: "Escrow for contract: Transcription Job",
      status: "completed",
      relatedContract: transcribeContract._id,
    },
    {
      user: fatima._id,
      type: "escrow_out",
      amount: 750000,
      currency: "NGN",
      description: "Escrow released — Transcription contract completed",
      status: "completed",
      relatedContract: transcribeContract._id,
    },
    {
      user: amina._id,
      type: "escrow_out",
      amount: 750000,
      currency: "NGN",
      description: "Payment released for: Transcription & Editing (5 hours)",
      status: "completed",
      relatedContract: transcribeContract._id,
    },
    {
      user: amina._id,
      type: "debit",
      amount: 500000,
      currency: "NGN",
      description: "Withdrawal to GTBank ****4521",
      status: "completed",
      bankDetails: {
        bankName: "GTBank",
        accountNumber: "0123454521",
        accountName: "Amina Bello",
      },
    },
    {
      user: chidi._id,
      type: "credit",
      amount: 1500000,
      currency: "NGN",
      description: "Payment for: Logo Design — Naijatech Events",
      status: "completed",
    },
    {
      user: chidi._id,
      type: "credit",
      amount: 3000000,
      currency: "NGN",
      description: "Payment for: E-commerce Website Redesign",
      status: "completed",
    },
  ]);

  console.log("\n🔔 Creating notifications...");
  await Notification.insertMany([
    {
      recipient: emeka._id,
      type: "new_application",
      message: 'New proposal received for "Design a Logo and Brand Identity". Review it now.',
      link: `job-details.html?id=${logoJob._id}#applications`,
      read: false,
    },
    {
      recipient: emeka._id,
      type: "new_application",
      message: 'Another proposal received for "Design a Logo and Brand Identity".',
      link: `job-details.html?id=${logoJob._id}#applications`,
      read: true,
    },
    {
      recipient: chidi._id,
      type: "contract_created",
      message: 'Your contract for "Build a Landing Page" is live. Good luck!',
      link: `contract-details.html?id=${landingContract._id}`,
      read: false,
    },
    {
      recipient: amina._id,
      type: "contract_completed",
      message: 'The client approved your work on "Transcribe and Edit 5 Hours". Payment released!',
      link: "payment.html",
      read: true,
    },
    {
      recipient: fatima._id,
      type: "application_accepted",
      message: "You accepted Chidi's proposal for \"Build a Landing Page\". Contract is now live.",
      link: `contract-details.html?id=${landingContract._id}`,
      read: false,
    },
    {
      recipient: chidi._id,
      type: "new_message",
      message: "New message from Fatima Aliyu.",
      link: `message.html?with=${fatima._id}`,
      read: false,
    },
  ]);

  console.log("\n💬 Creating messages...");
  const convId = [fatima._id.toString(), chidi._id.toString()].sort().join("_");

  const messageTimestamps = [
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
    new Date(Date.now() - 30 * 60 * 1000),
  ];

  await Message.insertMany([
    {
      conversationId: convId,
      sender: fatima._id,
      receiver: chidi._id,
      text: "Hi Chidi! I just accepted your proposal. Really excited to work with you on the landing page.",
      read: true,
      createdAt: messageTimestamps[0],
    },
    {
      conversationId: convId,
      sender: chidi._id,
      receiver: fatima._id,
      text: "Thank you Fatima! I'm equally excited. Could you share the existing brand assets you have? A logo, colour codes, or any reference sites you like would help me get started.",
      read: true,
      createdAt: messageTimestamps[1],
    },
    {
      conversationId: convId,
      sender: fatima._id,
      receiver: chidi._id,
      text: "Sure! Our brand colours are deep purple (#6B2FBE) and gold (#F5A623). Reference sites: Flutterwave and Paystack landing pages — I love how clean they are.",
      read: true,
      createdAt: messageTimestamps[2],
    },
    {
      conversationId: convId,
      sender: chidi._id,
      receiver: fatima._id,
      text: "Perfect, those are great references. I'll have a wireframe ready for your review by tomorrow. I'll send the link here.",
      read: true,
      createdAt: messageTimestamps[3],
    },
    {
      conversationId: convId,
      sender: chidi._id,
      receiver: fatima._id,
      text: "Hey Fatima, here's the wireframe: https://www.figma.com/file/example (dummy link). Let me know what you think before I move to code!",
      read: false,
      createdAt: messageTimestamps[4],
    },
  ]);

  console.log("\n✅ Seed complete.");
  await mongoose.connection.close();
  console.log("Connection closed.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  mongoose.connection.close();
  process.exit(1);
});

