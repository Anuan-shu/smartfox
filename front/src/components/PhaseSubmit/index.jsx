import { useState } from 'react';
import styles from './PhaseSubmit.module.css';

export default function PhaseSubmit({ phase, experimentId }) {
  const [answer, setAnswer] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`http://localhost:3002/api/student/experiment/${experimentId}/phase/${phase.phase_id}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ answer })
      });
      alert('保存成功');
    } catch (error) {
      alert('保存失败');
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.container}>
      <h3>{phase.title}</h3>
      <div className={styles.description}>{phase.description}</div>
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder="在此输入你的答案"
      />
      <div className={styles.buttonGroup}>
        <button 
          type="button" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '暂存答案'}
        </button>
      </div>
    </div>
  );
}