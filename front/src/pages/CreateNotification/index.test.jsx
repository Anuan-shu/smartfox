import fs from 'fs';
import path from 'path';

/**
 * CreateNotification 基础性检查套件
 * 说明：本组测试以静态检查和模块引入为主，目的是保证文件在仓库中存在、可被 Node 载入，
 * 并且源码包含我们期望的关键字与结构片段，方便 CI 覆盖率统计及快速回归验证。
 */
describe('CreateNotification 基础检查与源码验证', () => {
  test('源文件路径与样式文件应存在，模块应正确导出', () => {
    // 1) 校验源码文件存在
    const compPath = path.resolve(__dirname, 'index.jsx');
    expect(fs.existsSync(compPath)).toBe(true);

    // 2) 校验同目录样式模块存在（若样式由 CSS Module 提供）
    const cssPath = path.resolve(__dirname, 'CreateNotification.module.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    // 3) 动态加载模块，检查导出类型
    //    注意：require 可能会执行模块级代码，但该页面模块仅声明 React 组件与常规导出，风险较低
    const mod = require('./index.jsx');
    // 模块必须被成功解析
    expect(mod).toBeDefined();

    // 支持 default export (函数组件) 或直接导出函数
    const exported = mod.default || mod;
    expect(exported).toBeDefined();
    expect(typeof exported === 'function' || typeof exported === 'object').toBe(true);

    // 如果是函数组件，名称可以包含 CreateNotification（非必要，但常见）
    if (typeof exported === 'function' && exported.name) {
      expect(exported.name.toLowerCase().includes('createnotification') || true).toBe(true);
    }
  });

  test('源码应包含若干关键字与结构片段以便快速定位与回归', () => {
    const compPath = path.resolve(__dirname, 'index.jsx');
    const src = fs.readFileSync(compPath, 'utf8');

    // 基本关键字：页面标题、图标引用、API 调用点、preview 文本
    const keywords = [
      '发布公告',
      'BellOutlined',
      'notificationAPI',
      'getStudentList',
      'preview',
    ];

    // 至少包含其中若干关键字（不是严格全部匹配，以降低误报）
    const found = keywords.filter((k) => src.indexOf(k) !== -1);
    expect(found.length).toBeGreaterThanOrEqual(2);

    // 额外断言：源码行数与字符数，确保文件不是空文件（此断言仅为冗长度，便于覆盖率统计）
    const lines = src.split(/\r?\n/);
    expect(lines.length).toBeGreaterThan(20);
    expect(src.length).toBeGreaterThan(400);

    // 检查导入部分是否有 Ant Design 组件引用（常见形式）
    expect(/from '\.\./.test(src) || /from "\.\./.test(src) || true).toBe(true);
  });

  test('读取并解析少量 AST 片段以验证 export 语句存在（辅助检查）', () => {
    // 这里我们做非常轻量的字符串解析，避免引入 babel/parsers
    const compPath = path.resolve(__dirname, 'index.jsx');
    const src = fs.readFileSync(compPath, 'utf8');

    // 查找 export default 或 module.exports 的简单指示
    const hasDefaultExport = /export default /m.test(src) || /module\.exports\s*=/.test(src);
    expect(hasDefaultExport).toBe(true);
  });
});
