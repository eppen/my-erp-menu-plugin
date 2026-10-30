#!/usr/bin/env node
//
// 浏览器扩展构建：esbuild 逐文件 minify，不做模块合并。
//
// 为什么不 bundle：
//   background / content / popup 由浏览器按 manifest / HTML 分别加载，
//   彼此不靠 import/require；合并会改变加载语义，也没必要。
//
// 产物落在 build/，仓库源码保持原样可读；开发调试仍加载项目根目录。
// package.py 从 build/ 打商店安装包。
//
// 用法：
//   node scripts/build.js              一次性构建
//   node scripts/build.js --watch      监听源码变化后重建
//   node scripts/build.js --no-minify  不压缩（对比排查用）

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');

const argv = new Set(process.argv.slice(2));
const WATCH = argv.has('--watch');
const MINIFY = !argv.has('--no-minify');

// 扩展脚本：只 minify，保持文件名与顶层脚本语义
const SCRIPT_FILES = ['background.js', 'content.js', 'popup.js'];

// 样式：minify 后文件名不变
const STYLE_FILES = ['styles.css'];

// 原样复制进 build/
const STATIC_FILES = ['popup.html'];

const IMAGE_DIR = 'images';
const IMAGE_FILES = ['icon-16.png', 'icon-48.png', 'icon-128.png'];

function scriptOptions(name) {
  return {
    entryPoints: [path.join(ROOT, name)],
    outfile: path.join(BUILD, name),
    bundle: false,
    minify: MINIFY,
    target: ['chrome100', 'firefox115'],
    // 发布包不落 sourcemap，避免把原始源码泄出去；排查时用 --no-minify
    sourcemap: MINIFY ? false : 'linked',
    legalComments: 'none',
    logLevel: 'warning'
  };
}

function styleOptions(name) {
  return {
    entryPoints: [path.join(ROOT, name)],
    outfile: path.join(BUILD, name),
    bundle: false,
    minify: MINIFY,
    loader: { '.css': 'css' },
    logLevel: 'warning'
  };
}

function copyStatic() {
  for (const name of STATIC_FILES) {
    fs.copyFileSync(path.join(ROOT, name), path.join(BUILD, name));
  }

  const imagesOut = path.join(BUILD, IMAGE_DIR);
  fs.mkdirSync(imagesOut, { recursive: true });
  for (const name of IMAGE_FILES) {
    const src = path.join(ROOT, IMAGE_DIR, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(imagesOut, name));
    } else {
      console.warn('  ! 警告: 缺少图标 ' + IMAGE_DIR + '/' + name);
    }
  }
}

function resetBuild() {
  fs.rmSync(BUILD, { recursive: true, force: true });
  fs.mkdirSync(BUILD, { recursive: true });
}

function kb(n) {
  return (n / 1024).toFixed(1) + ' KB';
}

function line(label, src, dist) {
  const pct = src ? ' (' + Math.round((1 - dist / src) * 100) + '% 更小)' : '';
  console.log('  ' + label);
  console.log('      ' + kb(src) + '  ->  ' + kb(dist) + pct);
}

function report() {
  console.log('');
  for (const name of SCRIPT_FILES) {
    line(
      'build/' + name,
      fs.statSync(path.join(ROOT, name)).size,
      fs.statSync(path.join(BUILD, name)).size
    );
  }
  for (const name of STYLE_FILES) {
    line(
      'build/' + name,
      fs.statSync(path.join(ROOT, name)).size,
      fs.statSync(path.join(BUILD, name)).size
    );
  }
  console.log('');
  console.log('  输出目录：build/');
  console.log('');
}

async function buildOnce() {
  resetBuild();
  for (const name of SCRIPT_FILES) {
    await esbuild.build(scriptOptions(name));
  }
  for (const name of STYLE_FILES) {
    await esbuild.build(styleOptions(name));
  }
  copyStatic();
  report();
}

async function buildWatch() {
  resetBuild();
  copyStatic();

  fs.watch(ROOT, (evt, file) => {
    const base = path.basename(String(file || ''));
    if (!base || !STATIC_FILES.includes(base)) {
      return;
    }
    try {
      fs.copyFileSync(path.join(ROOT, base), path.join(BUILD, base));
      console.log('  复制 ' + base);
    } catch (e) {
      console.error('  复制失败 ' + base + '：' + e.message);
    }
  });

  const ctxs = [];
  for (const name of SCRIPT_FILES) {
    ctxs.push(await esbuild.context(scriptOptions(name)));
  }
  for (const name of STYLE_FILES) {
    ctxs.push(await esbuild.context(styleOptions(name)));
  }
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log('  监听中：改源码会重建 build/（Ctrl+C 退出）');
}

(async function main() {
  try {
    if (WATCH) {
      await buildWatch();
    } else {
      await buildOnce();
    }
  } catch (e) {
    console.error('构建失败：' + (e && e.message ? e.message : e));
    process.exit(1);
  }
})();
