interface ScoreBarProps {
  label: string;
  score: number;
  maxScore: number;
}

export default function ScoreBar({ label, score, maxScore }: ScoreBarProps) {
  const percentage = (score / maxScore) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="text-xs text-gray-500 min-w-40">{label}</div>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
        <div
          className="h-full rounded-full bg-gray-800"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-400 min-w-14 text-right">
        {score}/{maxScore}
      </div>
    </div>
  );
}
