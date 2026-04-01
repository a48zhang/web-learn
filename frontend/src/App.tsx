import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4">
            <h1 className="text-3xl font-bold text-gray-900">
              专题学习平台
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 px-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-gray-700">
        欢迎使用专题学习平台
      </h2>
      <p className="mt-2 text-gray-600">
        平台正在初始化中...
      </p>
    </div>
  );
}

export default App;