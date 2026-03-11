import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.178.62",  // Tvoja lokalna IP
    "192.168.178.*",   // Ili wildcard za subnet ako treba
    "localhost:3000",  // Dodaj i localhost za sigurnost
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
