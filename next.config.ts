import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com', // Useful for later
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // 👈 Whitelist Google Auth images
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com', // 👈 Catch-all for other Google subdomains
      },

      {
        protocol: 'https',
        hostname: 'ecomsync-assets.s3.ap-south-1.amazonaws.com',
        port: '',
        pathname: '/**', // Allows all files inside this bucket
      },
    ],
  },
};

export default nextConfig;
