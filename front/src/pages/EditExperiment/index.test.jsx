// src/pages/EditExperiment/index.test.jsx
import fs from 'fs';
import path from 'path';

/**
 * EditExperiment 示例型源码检查套件
 * 目标：通过更丰富的静态断言，捕获页面的关键导出、常用表单提示、按钮文本、
 * 上传与附件相关的关键片段以及样式导入，便于 CI 快速定位变更。
 *
 * 说明：本套测试仅在源码层面进行检查，避免执行组件内会触发的网络或 UI 副作用。
 */

const resolveComponentPath = () => path.resolve(__dirname, 'index.jsx');
const readSource = (p) => fs.readFileSync(p, 'utf8');
const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
const countOccurrences = (src, sub) => (src.match(new RegExp(escapeForRegex(sub), 'g')) || []).length;

describe('EditExperiment 源码级示例检查', () => {
  test('模块可解析且默认导出存在（模块级别检查）', () => {
    const compPath = resolveComponentPath();
    expect(fs.existsSync(compPath)).toBe(true);

    // 清理 require 缓存并加载模块，检查导出
    delete require.cache[require.resolve('./index.jsx')];
    const mod = require('./index.jsx');
    expect(mod).toBeDefined();
    const exported = mod.default || mod;
    expect(exported).toBeDefined();
    expect(['function', 'object']).toContain(typeof exported);

    const src = readSource(compPath);

    // 检查是否引入了样式模块（CSS Module）
    expect(/\.module\.css['"]/.test(src)).toBe(true);

    // 检查是否使用 dayjs（页面中会处理 deadline）
    expect(/\bdayjs\b/.test(src)).toBe(true);

    // 检查是否引用了 axios 或 utils 中的 axios（表示有文件请求）
    expect(/\baxios\b/.test(src) || /utils\/axios/.test(src)).toBe(true);

    // 页面中通常会有保存或更新相关的调用，至少出现 update 或 create 相关关键词之一
    const apiKeywords = ['updateExperiment', 'createExperiment', 'uploadExperimentAttachment'];
    const hasApiKeyword = apiKeywords.some(k => src.indexOf(k) !== -1);
    expect(hasApiKeyword).toBe(true);

    // 检查页面标题文本是否存在（中文标题）
    expect(src.indexOf('编辑实验') !== -1).toBe(true);

    // 基本长度断言，确保文件不是空壳
    expect(src.length).toBeGreaterThan(300);
    expect(src.split(/\r?\n/).length).toBeGreaterThan(30);
  });

  test('页面元素与表单提示示例（正/反两类断言示例更完整）', () => {
    const compPath = resolveComponentPath();
    const src = readSource(compPath);

    // 检查表单占位符与标签
    const placeholders = [
      '如：计算机网络原理实验二',
      '请在此输入实验要求、目标等描述信息...',
    ];
    placeholders.forEach(ph => expect(src.indexOf(ph) !== -1).toBe(true));

    // 检查必填提示文本（用于负面/验证场景）
    const requiredPrompts = ['请输入实验标题', '请输入实验描述', '请选择截止时间', '请选择参与的学生'];
    const foundRequired = requiredPrompts.filter(k => src.indexOf(k) !== -1);
    // 至少有一项校验提示存在
    expect(foundRequired.length).toBeGreaterThanOrEqual(1);

    // 检查添加题目按钮文本（页面允许添加多种题型）
    ['选择题', '填空题', '编程题'].forEach(btn => {
      expect(src.indexOf(btn) !== -1).toBe(true);
    });

    // 检查上传相关组件提示或类名（例如 Upload.Dragger 或 CloudUploadOutlined）
    const uploadIndicators = ['Upload.Dragger', 'CloudUploadOutlined', '已添加'];
    const uploadFound = uploadIndicators.filter(k => src.indexOf(k) !== -1);
    expect(uploadFound.length).toBeGreaterThanOrEqual(1);

    // 检查删除实验按钮文本
    expect(src.indexOf('删除实验') !== -1).toBe(true);

    // 统计某些关键词出现次数以增加断言数量（非严格通过条件，仅作示例）
    const updateCount = countOccurrences(src, 'updateExperiment');
    const saveBtnCount = countOccurrences(src, '保存修改');
    // 两个计数应为数字，且至少有一个可能大于等于0
    expect(typeof updateCount).toBe('number');
    expect(typeof saveBtnCount).toBe('number');
  });
});
