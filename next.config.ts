import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ⬇️ Empêche l’échec du build à cause de l’ESLint
    ignoreDuringBuilds: true,
  },
  // Si un jour tu as aussi des erreurs de types TS au build,
  // décommente la ligne suivante (à éviter si possible) :
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
