import subprocess
import os
import tempfile
import shutil
import time
import json

# resource module 在 windows 上不可用
try:
    import resource

    IS_UNIX = True
except ImportError:
    IS_UNIX = False

from flask import Flask, request, jsonify


STATUS_ACCEPTED = "Accepted"
STATUS_WRONG_ANSWER = "Wrong Answer"
STATUS_TIME_LIMIT_EXCEEDED = "Time Limit Exceeded"
STATUS_MEMORY_LIMIT_EXCEEDED = "Memory Limit Exceeded"
STATUS_RUNTIME_ERROR = "Runtime Error"
STATUS_COMPILE_ERROR = "Compilation Error"
STATUS_INTERNAL_ERROR = "Internal Error"


if os.name == 'nt':  # Windows
    PYTHON_EXECUTABLE = "python"
    CPP_EXE_SUFFIX = ".exe"
    RUN_PREFIX = ""
else:  # Unix-like (Linux, macOS)
    PYTHON_EXECUTABLE = "python3"
    CPP_EXE_SUFFIX = ""
    RUN_PREFIX = ""

# --- 编程语言配置 ---
LANGUAGE_CONFIG = {
    "python": {
        "compile_cmd": None,
        "run_cmd": f"{PYTHON_EXECUTABLE} {{src_file}}"
    },
    "cpp": {
        "compile_cmd": f"g++ {{src_file}} -o {{exe_file_base}}{CPP_EXE_SUFFIX} -O2 -std=c++17",
        "run_cmd": f"{RUN_PREFIX}{{exe_file_base}}{CPP_EXE_SUFFIX}"
    },
    "java": {
        "compile_cmd": "javac {src_file}",  # Assumes Main.java -> class Main
        "run_cmd": "java {class_name}"
    }

}

# --- Default Limits ---
DEFAULT_TIME_LIMIT = 2  # seconds
DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024  # 256 MB



def set_resource_limits_unix(time_limit_sec, memory_limit_bytes):
    if IS_UNIX:
        try:
            # CPU time limit (soft and hard)
            resource.setrlimit(resource.RLIMIT_CPU,
                               (time_limit_sec, time_limit_sec + 1))  # Add a grace second for hard limit
            # Virtual memory limit (soft and hard)
        except Exception as e:
            # This print will happen inside the subprocess if preexec_fn is used
            print(f"Warning (in preexec_fn): Could not set resource limits: {e}")


def compare_outputs(actual_output, expected_output):
    actual_lines = [line.rstrip() for line in actual_output.strip().splitlines()] # 实际输出
    expected_lines = [line.rstrip() for line in expected_output.strip().splitlines()] # 期望输出

    while actual_lines and not actual_lines[-1]:
        actual_lines.pop()
    while expected_lines and not expected_lines[-1]:
        expected_lines.pop()

    return actual_lines == expected_lines



def evaluate_code(language, source_code, test_cases,
                  time_limit_sec=DEFAULT_TIME_LIMIT,
                  memory_limit_bytes=DEFAULT_MEMORY_LIMIT_BYTES):

    num_total_cases = len(test_cases)

    # 不支持的编程语言
    if language not in LANGUAGE_CONFIG:
        case_results = [{"status": STATUS_INTERNAL_ERROR,
                         "message": f"不支持的编程语言：'{language}'"}]
        summary = {
            "total_cases": num_total_cases, "passed_cases": 0, "pass_rate_percent": 0.0,
            "overall_status": STATUS_INTERNAL_ERROR
        }
        return {"case_results": case_results, "summary": summary}

    config = LANGUAGE_CONFIG[language]
    case_execution_results = []

    # 创建临时目录，存放源代码和编译/执行文件
    temp_dir_base = os.path.join(os.getcwd(), "temp_eval_workspace")  # 临时工作目录
    os.makedirs(temp_dir_base, exist_ok=True)  # 确保临时目录存在
    temp_dir = tempfile.mkdtemp(dir=temp_dir_base, prefix="run_")  # 创建唯一的临时目录

    # 定义源代码文件名和可执行文件名
    src_file_name_base = "Main" if language == "java" else "source"
    src_file_extension = ".java" if language == "java" else f".{language if language != 'cpp' else 'cpp'}"
    src_file_name = f"{src_file_name_base}{src_file_extension}"
    src_file_path = os.path.join(temp_dir, src_file_name)

    # 定义编译后的可执行文件名
    exe_file_base_name = "program"
    exe_file_path_base = os.path.join(temp_dir, exe_file_base_name)  # 不带后缀的可执行文件名

    class_name_for_java = src_file_name_base if language == "java" else None

    with open(src_file_path, "w", encoding="utf-8") as f:
        f.write(source_code)

    # 编译源代码
    compilation_failed = False
    compilation_output = {"stdout": "", "stderr": "", "details": ""}

    if config["compile_cmd"]:
        # 格式化编译命令
        compile_cmd_str = config["compile_cmd"].format(
            src_file=src_file_path,
            exe_file_base=exe_file_path_base
        )
        try:
            compile_process = subprocess.run(
                compile_cmd_str.split(),
                capture_output=True, text=True, timeout=30,  # 编译超时
                cwd=temp_dir  # 在临时目录中执行编译命令
            )
            if compile_process.returncode != 0:
                compilation_failed = True
                compilation_output["stdout"] = compile_process.stdout
                compilation_output["stderr"] = compile_process.stderr
                compilation_output["details"] = "Compilation failed."
        except subprocess.TimeoutExpired:
            compilation_failed = True
            compilation_output["details"] = "Compilation timed out."
        except FileNotFoundError as e:
            compilation_failed = True
            compilation_output["details"] = f"Compiler not found ({e}). Ensure it's in PATH."
        except Exception as e:
            compilation_failed = True
            compilation_output["details"] = f"Unexpected compilation error: {e}"

    if compilation_failed:
        shutil.rmtree(temp_dir)
        case_results = [{
            "status": STATUS_COMPILE_ERROR,
            "stdout": compilation_output["stdout"],
            "stderr": compilation_output["stderr"],
            "details": compilation_output["details"]
        }] * num_total_cases
        summary = {
            "total_cases": num_total_cases, "passed_cases": 0, "pass_rate_percent": 0.0,
            "overall_status": STATUS_COMPILE_ERROR, "compilation_output": compilation_output
        }
        return {"case_results": case_results, "summary": summary}

    # --- 对每一个评测点进行评测 ---
    first_error_status = None

    for i, case in enumerate(test_cases):
        test_input = case.get("input", "")  # 默认无输入
        expected_output = case.get("expected_output", "")  # 默认无输出
        case_result = {
            "status": "", "stdout": "", "stderr": "", "time_taken": 0.0,
            "memory_used_bytes": "N/A" if not IS_UNIX else 0  # 内存使用量
        }

        run_cmd_str_template = config["run_cmd"]
        run_cmd_str = run_cmd_str_template.format(
            src_file=src_file_path,  # For interpreted languages like Python
            exe_file_base=exe_file_path_base,  # For compiled languages
            class_name=class_name_for_java  # For Java
        )

        # On Windows, remove leading './' if present (from Unix-style config)
        if os.name == 'nt' and run_cmd_str.startswith("./"):
            run_cmd_str = run_cmd_str[2:]

        effective_timeout = time_limit_sec + 0.5  # 超时

        preexec_fn_to_use = None
        if IS_UNIX:
            # 设置资源限制（UNIX下）
            preexec_fn_to_use = lambda: set_resource_limits_unix(time_limit_sec, memory_limit_bytes)

        start_time = time.perf_counter()
        try:
            process = subprocess.run(
                run_cmd_str.split(),
                input=test_input,
                capture_output=True, text=True,
                timeout=effective_timeout,
                cwd=temp_dir,
                preexec_fn=preexec_fn_to_use  # Only on Unix
            )
            end_time = time.perf_counter()
            case_result["time_taken"] = round(end_time - start_time, 3)

            actual_output = process.stdout
            case_result["stdout"] = actual_output
            case_result["stderr"] = process.stderr

            if process.returncode != 0:
                # 处理运行时错误，内存限制、运行时错误
                if "MemoryError" in process.stderr or "std::bad_alloc" in process.stderr or \
                        (IS_UNIX and process.returncode == -9):  # SIGKILL, often due to OOM killer
                    case_result["status"] = STATUS_MEMORY_LIMIT_EXCEEDED
                else:
                    case_result["status"] = STATUS_RUNTIME_ERROR
            elif compare_outputs(actual_output, expected_output):
                case_result["status"] = STATUS_ACCEPTED
            else:
                case_result["status"] = STATUS_WRONG_ANSWER
                case_result["expected_output"] = expected_output  # 显示期望输出

        except subprocess.TimeoutExpired:
            case_result["status"] = STATUS_TIME_LIMIT_EXCEEDED
            case_result["time_taken"] = time_limit_sec  # 设置为超时限制
        except FileNotFoundError:  # 找不到可执行文件或脚本
            case_result["status"] = STATUS_RUNTIME_ERROR
            case_result["stderr"] = f"Executable or script not found for: {run_cmd_str}"
        except Exception as e:  # 其他异常
            case_result["status"] = STATUS_INTERNAL_ERROR
            case_result["stderr"] = str(e)

        case_execution_results.append(case_result)

        if case_result["status"] != STATUS_ACCEPTED and first_error_status is None:
            first_error_status = case_result["status"]

        # 遇到TLE、MLE、RE等，提前退出评测循环
        if case_result["status"] not in [STATUS_ACCEPTED, STATUS_WRONG_ANSWER]:
            # 为跳过的测试用例添加结果
            for _ in range(i + 1, num_total_cases):
                skipped_result = {"status": case_result["status"], "details": "Skipped due to previous critical error."}
                case_execution_results.append(skipped_result)
            if first_error_status is None: first_error_status = case_result["status"]
            break # 跳出评测循环

    # 清理临时目录
    try:
        shutil.rmtree(temp_dir)
    except Exception as e:
        print(f"Warning: Could not remove temporary directory {temp_dir}: {e}")

    # 计算通过率和总体状态
    passed_count = 0
    for res in case_execution_results:
        if res.get("status") == STATUS_ACCEPTED:
            passed_count += 1

    pass_rate_percent = 0.0
    if num_total_cases > 0:
        pass_rate_percent = round((passed_count / num_total_cases) * 100, 2)

    overall_status = STATUS_ACCEPTED  # 评测点全部通过的默认状态
    if passed_count < num_total_cases:  # 如果有测试点未通过
        if first_error_status:  # 第一个异常状态
            overall_status = first_error_status
        elif num_total_cases > 0:  # 无异常但有测试点未通过
            overall_status = STATUS_WRONG_ANSWER
        else:  # 无测试点
            overall_status = STATUS_INTERNAL_ERROR

    summary_data = {
        "total_cases": num_total_cases,
        "passed_cases": passed_count,
        "pass_rate_percent": pass_rate_percent,
        "overall_status": overall_status
    }

    return {"case_results": case_execution_results, "summary": summary_data}


app = Flask(__name__)


@app.route('/evaluate', methods=['POST'])
def handle_evaluate():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()

    required_fields = ["language", "source_code", "test_cases"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"缺少参数: {field}"}), 400

    if not isinstance(data["test_cases"], list):
        return jsonify({"error": "'test_cases' must be a list"}), 400

    # 验证每个测试用例是否有效
    for tc_idx, tc in enumerate(data["test_cases"]):
        if not isinstance(tc, dict) or "input" not in tc or "expected_output" not in tc:
            return jsonify(
                {"error": f"Test case at index {tc_idx} must be a dictionary with 'input' and 'expected_output'"}), 400

    language = data["language"]
    source_code = data["source_code"]
    test_cases = data["test_cases"]

    # 获取可选的时间限制和内存限制
    time_limit = data.get("time_limit", DEFAULT_TIME_LIMIT)
    memory_limit_mb = data.get("memory_limit_mb", DEFAULT_MEMORY_LIMIT_BYTES / (1024 * 1024))  # MB
    memory_limit_bytes = int(memory_limit_mb * 1024 * 1024)  # 转换为字节

    # 日志记录请求信息
    print(f"收到评测信息: {language}, {len(test_cases)} test cases.")
    print(f"评测代码:\n{source_code[:1000]}")

    try:
        # 调用评测函数
        evaluation_response = evaluate_code(
            language=language,
            source_code=source_code,
            test_cases=test_cases,
            time_limit_sec=time_limit,
            memory_limit_bytes=memory_limit_bytes
        )
        return jsonify(evaluation_response), 200
    except Exception as e:
        # 记录异常信息
        app.logger.error(f"Critical error during evaluation endpoint: {e}", exc_info=True)
        # 返回通用错误响应
        num_cases_for_error = len(test_cases) if 'test_cases' in data and isinstance(data['test_cases'], list) else 0
        return jsonify({
            "error": "An internal server error occurred while processing the evaluation.",
            "details": "Please contact support or check server logs.",
            "summary": {
                "total_cases": num_cases_for_error,
                "passed_cases": 0,
                "pass_rate_percent": 0.0,
                "overall_status": STATUS_INTERNAL_ERROR
            },
            "case_results": [{"status": STATUS_INTERNAL_ERROR,
                              "details": "Judge system failed to process request."}]
        }), 500



if __name__ == '__main__':
    # 创建临时工作目录
    temp_workspace_dir = os.path.join(os.getcwd(), "temp_eval_workspace")
    os.makedirs(temp_workspace_dir, exist_ok=True)

    print(f"Starting Flask server on http://localhost:8080")
    print(f"Running on OS: {os.name} (Unix-like features enabled: {IS_UNIX})")
    if not IS_UNIX:
        print("### WARNING: Windows下不含'resource'模块，不强制执行严格内存限制，建议在UNIX-LIKE下运行 ###")
        print("### Windows下基于挂钟时间进行时间限制 ###")

    app.run(host='0.0.0.0', port=8080, debug=True)