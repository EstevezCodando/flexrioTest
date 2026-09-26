(async () => {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');

    let dir = process.cwd();
    let rootDir = null;
    while (dir && dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(dir, '.git'))) {
        rootDir = dir;
        break;
      }
      dir = path.dirname(dir);
    }
    if (!rootDir) {
      rootDir = process.cwd();
    }

    const appDir = path.resolve(rootDir, 'artifacts', 'rio-flex');
    const possibleSources = [
      path.resolve(appDir, 'dist'),
      path.resolve(appDir, 'dist', 'public'),
      path.resolve(rootDir, 'dist'),
    ];

    const src = possibleSources.find(p => fs.existsSync(path.join(p, 'index.html')));

    if (!src) {
      console.log('[prepare-deploy] No index.html found yet in source paths.');
      process.exit(0);
    }

    const indexHtmlPath = path.join(src, 'index.html');
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Create physical static sub-route directories to prevent 404 on direct URL / PWA start_url load
    const knownRoutes = [
      'app',
      'app/map',
      'app/session',
      'app/wallet',
      'app/profile',
      'login',
      'auth',
      'onboarding',
      'receipt',
    ];

    for (const r of knownRoutes) {
      const targetRouteDir = path.join(src, r);
      fs.mkdirSync(targetRouteDir, { recursive: true });
      fs.writeFileSync(path.join(targetRouteDir, 'index.html'), indexHtmlContent);
    }
    console.log('[prepare-deploy] Static fallback routes generated for PWA & direct access.');

    const targets = [
      path.resolve(rootDir, 'public'),
      path.resolve(rootDir, 'dist'),
    ];

    for (const target of targets) {
      if (target === src) continue;
      try {
        fs.rmSync(target, { recursive: true, force: true });
        fs.cpSync(src, target, { recursive: true });
        console.log(`[prepare-deploy] Copied build output to: ${target}`);
      } catch (err) {
        console.warn(`[prepare-deploy] Could not copy to ${target}:`, err.message);
      }
    }

    console.log('[prepare-deploy] Output directories prepared successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[prepare-deploy] Error:', err);
    process.exit(0);
  }
})();
