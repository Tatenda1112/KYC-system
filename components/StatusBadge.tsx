interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getBadgeStyles = () => {
    switch (status.toLowerCase()) {
      case 'verified':
        return 'bg-gray-900 text-white';
      case 'pending':
        return 'bg-gray-100 text-gray-600';
      case 'flagged':
        return 'bg-gray-900 text-white border border-gray-900';
      case 'rejected':
        return 'bg-gray-200 text-gray-500';
      case 'pass':
        return 'bg-gray-800 text-white';
      case 'fail':
        return 'bg-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <span
      className={`inline-flex text-xs px-2 py-0.5 rounded font-medium ${getBadgeStyles()}`}
    >
      {status}
    </span>
  );
}
