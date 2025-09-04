import glob
import shutil
import subprocess
import unittest
import tempfile
import os
import sys
import json
from unittest.mock import patch, MagicMock

# 添加当前目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入被测试的模块
from app import evaluate_code, compare_outputs, STATUS_ACCEPTED, STATUS_WRONG_ANSWER

class TestJudger(unittest.TestCase):
    def setUp(self):
        # 在每个测试开始前，确保临时目录不存在
        temp_workspace = os.path.join(os.getcwd(), "temp_eval_workspace")
        if os.path.exists(temp_workspace):
            shutil.rmtree(temp_workspace)
    
    def tearDown(self):
        # 在每个测试结束后，清理临时目录和 __pycache__
        self.cleanup_temp_files()
    
    @classmethod
    def tearDownClass(cls):
        # 在所有测试结束后，再次清理确保没有遗漏
        cls.cleanup_temp_files_class()
    
    def cleanup_temp_files(self):
        # 清理临时工作目录
        temp_workspace = os.path.join(os.getcwd(), "temp_eval_workspace")
        if os.path.exists(temp_workspace):
            shutil.rmtree(temp_workspace)
        
        # 清理 __pycache__ 目录
        for root, dirs, files in os.walk(os.getcwd()):
            for dir_name in dirs:
                if dir_name == "__pycache__":
                    pycache_path = os.path.join(root, dir_name)
                    shutil.rmtree(pycache_path, ignore_errors=True)
    
    @classmethod
    def cleanup_temp_files_class(cls):
        # 类级别的清理方法
        temp_workspace = os.path.join(os.getcwd(), "temp_eval_workspace")
        if os.path.exists(temp_workspace):
            shutil.rmtree(temp_workspace)
        
        # 清理所有 __pycache__ 目录
        for pycache_dir in glob.glob("**/__pycache__", recursive=True):
            shutil.rmtree(pycache_dir, ignore_errors=True)
            
    def test_compare_outputs(self):
        # 测试输出比较功能
        self.assertTrue(compare_outputs("hello\nworld", "hello\nworld"))
        self.assertTrue(compare_outputs("hello\nworld\n", "hello\nworld"))
        self.assertFalse(compare_outputs("  hello  \n  world  ", "hello\nworld"))
        self.assertFalse(compare_outputs("hello", "world"))
        self.assertFalse(compare_outputs("hello\nworld", "hello\nearth"))
    
    def test_python_evaluation(self):
        # 测试 Python 代码评测
        python_code = "print('Hello, World!')"
        test_cases = [{"input": "", "expected_output": "Hello, World!"}]
        
        result = evaluate_code("python", python_code, test_cases)
        
        self.assertEqual(result["summary"]["overall_status"], STATUS_ACCEPTED)
        self.assertEqual(result["summary"]["passed_cases"], 1)
        self.assertEqual(result["summary"]["total_cases"], 1)
    
    def test_python_wrong_answer(self):
        # 测试错误的 Python 代码
        python_code = "print('Wrong Output!')"
        test_cases = [{"input": "", "expected_output": "Hello, World!"}]
        
        result = evaluate_code("python", python_code, test_cases)
        
        self.assertEqual(result["summary"]["overall_status"], STATUS_WRONG_ANSWER)
        self.assertEqual(result["summary"]["passed_cases"], 0)
    
    def test_unsupported_language(self):
        # 测试不支持的语言
        result = evaluate_code("ruby", "puts 'Hello'", [])
        
        self.assertEqual(result["summary"]["overall_status"], "Internal Error")
        self.assertIn("不支持的编程语言", result["case_results"][0]["message"])
    
    def test_compile_error(self):
        # 测试编译错误 (C++ 语法错误)
        cpp_code = "#include <iostream>\nint main() { return 0"  # 缺少闭合括号
        test_cases = [{"input": "", "expected_output": ""}]
        
        result = evaluate_code("cpp", cpp_code, test_cases)
        
        self.assertEqual(result["summary"]["overall_status"], "Compilation Error")
        self.assertIn("Compilation failed", result["case_results"][0]["details"])
    
    @patch('app.subprocess.run')
    def test_time_limit_exceeded(self, mock_run):
        # 测试超时情况
        # 模拟超时异常
        mock_run.side_effect = subprocess.TimeoutExpired("python", 2)
        
        python_code = "while True: pass"  # 无限循环
        test_cases = [{"input": "", "expected_output": ""}]
        
        result = evaluate_code("python", python_code, test_cases)
        
        self.assertEqual(result["summary"]["overall_status"], "Time Limit Exceeded")
    
    def test_multiple_test_cases(self):
        # 测试多个测试用例
        python_code = """
a = input()
b = input()
print(int(a) + int(b))
"""
        test_cases = [
            {"input": "1\n2", "expected_output": "3"},
            {"input": "5\n7", "expected_output": "12"},
            {"input": "-1\n1", "expected_output": "0"}
        ]
        
        result = evaluate_code("python", python_code, test_cases)
        
        self.assertEqual(result["summary"]["overall_status"], STATUS_ACCEPTED)
        self.assertEqual(result["summary"]["passed_cases"], 3)
        self.assertEqual(result["summary"]["total_cases"], 3)

if __name__ == '__main__':
    unittest.main()