const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function run() {
  try {
    const courseId = "8b7f656a-8d63-4f11-825a-f2fd05cf9140"; // fisica
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, name: true, gDriveSyncFiles: true }
    });

    if (!course) {
      console.log("Course not found!");
      return;
    }

    console.log("Course found:", course.name);
    console.log("gDriveSyncFiles:", course.gDriveSyncFiles);

    // Get accounts
    const accounts = await prisma.googleDriveAccount.findMany({
      where: { userId: course.teacherId }
    });
    console.log(`Found ${accounts.length} Google accounts for teacher.`);
    if (accounts.length === 0) return;
    
    const account = accounts[0];
    const accessToken = account.googleAccessToken;

    // List files in Google Drive matching the course name or period
    const query = `name contains 'Planilla_fisica' and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,parents)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.log("Error querying Drive:", await res.text());
      return;
    }

    const data = await res.json();
    console.log("\nFound files in Drive matching query:");
    for (const f of data.files || []) {
      console.log(`- Name: "${f.name}" | ID: ${f.id} | MIME: ${f.mimeType} | Modified: ${f.modifiedTime} | Parents: ${JSON.stringify(f.parents)}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
