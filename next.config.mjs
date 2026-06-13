/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure rubric.yaml is bundled with the /api/navigate serverless function
  // so the grader can read the canonical rubric at runtime on Vercel.
  experimental: {
    outputFileTracingIncludes: {
      '/api/navigate': ['./rubric.yaml'],
    },
  },
};

export default nextConfig;
