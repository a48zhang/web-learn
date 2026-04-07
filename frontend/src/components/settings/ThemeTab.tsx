import { useThemeStore } from '../../stores/useThemeStore';

export default function ThemeTab() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const themes = [
    { value: 'light' as const, label: '浅色模式', description: '明亮清爽的界面风格' },
    { value: 'dark' as const, label: '深色模式', description: '护眼的深色界面风格' },
  ];

  return (
    <div className="space-y-3">
      {themes.map((t) => (
        <label
          key={t.value}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            theme === t.value
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <input
            type="radio"
            name="theme"
            value={t.value}
            checked={theme === t.value}
            onChange={() => setTheme(t.value)}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{t.label}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.description}</div>
          </div>
        </label>
      ))}
      <p className="text-xs text-gray-400 dark:text-gray-500">主题更改会立即生效</p>
    </div>
  );
}
