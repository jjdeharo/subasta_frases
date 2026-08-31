import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: isGitHubPages ? '/subasta_frases/' : '',
};

export default nextConfig;
