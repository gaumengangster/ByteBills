import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js resolves `pdf.worker.mjs`; bundling breaks dynamic import unless external
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  allowedDevOrigins: [
    "192.168.178.62",
    "192.168.178.62:3001",
    "192.168.178.*",
    "localhost",
    "localhost:3000",
    "localhost:3001",
  ],
  /* config options here */
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'firebasestorage.googleapis.com',
          port: '',
          pathname: '**',
        },
      ],
    },
};

export default nextConfig;
