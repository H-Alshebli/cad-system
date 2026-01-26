"use client";

type StatsTableProps = {
  title: string;
  data: Record<string, number>;
  colorMap?: Record<string, string>;
};

export function StatsTable({ title, data, colorMap = {} }: StatsTableProps) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-gray-700 rounded p-4 text-gray-400">
        {title} – No data
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-gray-700 rounded">
      <div className="px-4 py-2 border-b border-gray-700 font-semibold">
        {title}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, count]) => {
            const color =
              colorMap[key] || "bg-gray-500/10 text-gray-300";

            return (
              <tr key={key} className="border-t border-gray-800">
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${color}`}
                  >
                    {key}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
