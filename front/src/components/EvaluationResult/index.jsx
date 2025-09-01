import PropTypes from 'prop-types';
import styles from './EvaluationResult.module.css';

export default function EvaluationResult({ result }) {
  if (!result) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>评测结果</h3>
      
      <div className={styles.summary}>
        <div className={`${styles.statusBadge} ${result.passed ? styles.success : styles.fail}`}>
          {result.passed ? '通过' : '未通过'}
        </div>
        <div className={styles.score}>
          得分: <span>{result.score || 0}</span>/100
        </div>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>执行时间:</span>
          <span>{result.executionTime || '--'} ms</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>内存消耗:</span>
          <span>{result.memoryUsage || '--'} MB</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>通过用例:</span>
          <span>{result.passedCases || 0}/{result.totalCases || 0}</span>
        </div>
      </div>

      {result.errorMessage && (
        <div className={styles.errorSection}>
          <div className={styles.errorTitle}>错误信息</div>
          <pre className={styles.errorMessage}>{result.errorMessage}</pre>
        </div>
      )}

      {result.testCases && result.testCases.length > 0 && (
        <div className={styles.testCases}>
          <h4>测试用例详情</h4>
          {result.testCases.map((testCase, index) => (
            <div key={index} className={`${styles.testCase} ${testCase.passed ? styles.casePassed : styles.caseFailed}`}>
              <div className={styles.caseHeader}>
                <span>用例 #{index + 1}</span>
                <span>{testCase.passed ? '✓' : '✗'}</span>
              </div>
              <div className={styles.caseDetail}>
                <div>输入: <code>{testCase.input}</code></div>
                <div>预期输出: <code>{testCase.expected}</code></div>
                {!testCase.passed && (
                  <div>实际输出: <code>{testCase.actual}</code></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

EvaluationResult.propTypes = {
  result: PropTypes.shape({
    passed: PropTypes.bool,
    score: PropTypes.number,
    executionTime: PropTypes.number,
    memoryUsage: PropTypes.number,
    errorMessage: PropTypes.string,
    passedCases: PropTypes.number,
    totalCases: PropTypes.number,
    testCases: PropTypes.arrayOf(
      PropTypes.shape({
        input: PropTypes.string,
        expected: PropTypes.string,
        actual: PropTypes.string,
        passed: PropTypes.bool
      })
    )
  })
};