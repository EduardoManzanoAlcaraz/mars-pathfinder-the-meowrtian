/** Static export; no server endpoints or hosted services required. */
const config = {
  output: 'export', trailingSlash: true, images: { unoptimized: true },
  webpack(config) {
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};
export default config;
