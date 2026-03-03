import axios from 'axios';
import { Client } from 'pg';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

type AuthResponse = { data: { accessToken: string } };

async function registerOrLogin(
  email: string,
  password: string,
  name: string,
  role?: 'USER' | 'INSTRUCTOR',
) {
  const registerUrl = `${apiBaseUrl}/v1/auth/sign-up`;
  const loginUrl = `${apiBaseUrl}/v1/auth/sign-in`;
  try {
    const response = await axios.post<AuthResponse>(registerUrl, {
      email,
      password,
      name,
      phone: null,
      role,
    });
    return response.data.data.accessToken;
  } catch {
    const response = await axios.post<AuthResponse>(loginUrl, {
      email,
      password,
    });
    return response.data.data.accessToken;
  }
}

async function main() {
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin+smoke@drivest.local';
  const instructorEmail = process.env.SMOKE_INSTRUCTOR_EMAIL || 'instructor+smoke@drivest.local';
  const learnerEmail = process.env.SMOKE_LEARNER_EMAIL || 'learner+smoke@drivest.local';
  const password = process.env.SMOKE_PASSWORD || 'SmokePass123!';

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  let adminToken = await registerOrLogin(adminEmail, password, 'Smoke Admin', 'USER');
  let instructorToken = await registerOrLogin(
    instructorEmail,
    password,
    'Smoke Instructor',
    'INSTRUCTOR',
  );
  let learnerToken = await registerOrLogin(learnerEmail, password, 'Smoke Learner', 'USER');

  await db.query('UPDATE users SET role = $1 WHERE email = $2', ['ADMIN', adminEmail]);
  await db.query('UPDATE users SET role = $1 WHERE email = $2', ['INSTRUCTOR', instructorEmail]);
  await db.query('UPDATE users SET role = $1 WHERE email = $2', ['USER', learnerEmail]);

  adminToken = await registerOrLogin(adminEmail, password, 'Smoke Admin', 'USER');
  instructorToken = await registerOrLogin(
    instructorEmail,
    password,
    'Smoke Instructor',
    'INSTRUCTOR',
  );
  learnerToken = await registerOrLogin(learnerEmail, password, 'Smoke Learner', 'USER');

  const instructorProfile = await axios.post(
    `${apiBaseUrl}/v1/instructors/profile`,
    {
      fullName: 'Smoke Instructor',
      email: instructorEmail,
      adiNumber: 'ADI12345',
      transmissionType: 'manual',
      hourlyRatePence: 4200,
      languages: ['English'],
      coveragePostcodes: ['SW1A'],
    },
    { headers: { Authorization: `Bearer ${instructorToken}` } },
  );

  const instructorId: string = instructorProfile.data.data.id;

  await axios.post(
    `${apiBaseUrl}/v1/admin/instructors/${instructorId}/approve`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );

  const lesson = await axios.post(
    `${apiBaseUrl}/v1/lessons`,
    {
      instructorId,
      durationMinutes: 90,
    },
    { headers: { Authorization: `Bearer ${learnerToken}` } },
  );

  const lessonId: string = lesson.data.data.id;

  await axios.patch(
    `${apiBaseUrl}/v1/lessons/${lessonId}/status`,
    { status: 'completed' },
    { headers: { Authorization: `Bearer ${instructorToken}` } },
  );

  await axios.post(
    `${apiBaseUrl}/v1/instructors/${instructorId}/reviews`,
    {
      lessonId,
      rating: 5,
      reviewText: 'Excellent instructor and clear explanations.',
    },
    { headers: { Authorization: `Bearer ${learnerToken}` } },
  );

  const publicProfile = await axios.get(`${apiBaseUrl}/v1/instructors/public/${instructorId}`);

  console.log('Smoke test complete');
  console.log(JSON.stringify(publicProfile.data.data, null, 2));

  await db.end();
}

main().catch((error) => {
  const payload = error.response?.data ?? error.message;
  console.error(payload);
  process.exit(1);
});
