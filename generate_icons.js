// 生成浏览器插件所需的图标文件
// 需要安装: npm install canvas

const fs = require('fs');
const path = require('path');

// 检查是否安装了 canvas
let Canvas;
try {
    Canvas = require('canvas');
} catch (e) {
    console.log('需要安装 canvas 库: npm install canvas');
    console.log('或者使用 Python 脚本: python generate_icons.py');
    console.log('或者打开 generate_icons.html 在浏览器中下载图标');
    process.exit(1);
}

function createIcon(size) {
    const canvas = Canvas.createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    const scale = size / 128;
    const margin = 4 * scale;
    const radius = (size / 2) - margin;
    const center = size / 2;
    
    // 背景圆形
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2d8cf0';
    ctx.fill();
    
    // 网格线（20% 透明度）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    
    // 水平线
    [40, 64, 88].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(32 * scale, y * scale);
        ctx.lineTo(96 * scale, y * scale);
        ctx.stroke();
    });
    
    // 垂直线
    [40, 64, 88].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x * scale, 32 * scale);
        ctx.lineTo(x * scale, 96 * scale);
        ctx.stroke();
    });
    
    // 菜单项
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1, 2 * scale);
    
    // 绘制圆角矩形函数
    function roundRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    const cornerRadius = Math.max(1, 2 * scale);
    
    // 菜单项1
    roundRect(36 * scale, 42 * scale, 56 * scale, 8 * scale, cornerRadius);
    ctx.fill();
    
    // 菜单项2
    roundRect(36 * scale, 60 * scale, 56 * scale, 8 * scale, cornerRadius);
    ctx.fill();
    
    // 菜单项3（较短）
    roundRect(36 * scale, 78 * scale, 40 * scale, 8 * scale, cornerRadius);
    ctx.fill();
    
    // 调整箭头
    const arrowX = 82 * scale;
    const arrowY = 64 * scale;
    const arrowSize = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize / 2);
    ctx.lineTo(arrowX + arrowSize, arrowY + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
    
    // 调整指示器（右上角）
    const indicatorSize = 8 * scale;
    const indicatorX = 100 * scale;
    const indicatorY = 28 * scale;
    
    // 黄色圆圈
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, indicatorSize, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.stroke();
    
    // 向上箭头
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.lineCap = 'round';
    const arrowIndSize = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(indicatorX - arrowIndSize, indicatorY);
    ctx.lineTo(indicatorX, indicatorY - arrowIndSize);
    ctx.lineTo(indicatorX + arrowIndSize, indicatorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(indicatorX, indicatorY - arrowIndSize);
    ctx.lineTo(indicatorX, indicatorY + arrowIndSize);
    ctx.stroke();
    
    return canvas;
}

// 生成所有尺寸的图标
const sizes = [16, 48, 128];
const scriptDir = __dirname;

console.log('正在生成图标...');
sizes.forEach(size => {
    const canvas = createIcon(size);
    const filename = path.join(scriptDir, `icon-${size}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`[OK] 已生成 icon-${size}.png (${size}x${size})`);
});

console.log('\n所有图标生成完成！');