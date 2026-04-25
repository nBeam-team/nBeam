import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Header } from './components/Header';
import type { Mode } from './components/ModeToggle';
import { InputForm } from './pages/InputForm';
import { Loading } from './pages/Loading';
import { Results } from './pages/Results';
import { SolarConfig } from './pages/SolarConfig';
import type { BuildingInsights } from './lib/google';
import type { FormInputs, SystemDesign } from './lib/types';

type View = 'form' | 'loading' | 'solar' | 'results';

function App() {
  const [view, setView] = useState<View>('form');
  const [inputs, setInputs] = useState<FormInputs | null>(null);
  const [insights, setInsights] = useState<BuildingInsights | null>(null);
  const [system, setSystem] = useState<SystemDesign | null>(null);
  const [text, setText] = useState<string>('');
  const [mode, setMode] = useState<Mode>('describe');

  const handleFormSubmit = (next: FormInputs, m: Mode, t?: string) => {
    setInputs(next);
    setMode(m);
    if (t !== undefined) setText(t);
    setView('loading');
  };

  const handleLoadingDone = () => setView('solar');

  const handleSolarContinue = (design: SystemDesign, ins: BuildingInsights | null) => {
    setSystem(design);
    setInsights(ins);
    setView('results');
  };

  const handleHome = () => setView('form');

  return (
    <div className="min-h-screen flex flex-col">
      <div data-no-print>
        <Header showHome={view !== 'form'} onHome={handleHome} />
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {view === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <InputForm
                initial={inputs ?? undefined}
                initialText={text}
                initialMode={mode}
                onSubmit={handleFormSubmit}
              />
            </motion.div>
          )}
          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Loading onDone={handleLoadingDone} />
            </motion.div>
          )}
          {view === 'solar' && inputs && (
            <motion.div
              key="solar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <SolarConfig
                inputs={inputs}
                initial={
                  system && insights
                    ? { config: system.config, insights }
                    : null
                }
                onContinue={handleSolarContinue}
                onBack={handleHome}
              />
            </motion.div>
          )}
          {view === 'results' && system && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <Results
                design={system}
                onChange={(next) => setSystem(next)}
                onBackToConfig={() => setView('solar')}
                onRestart={handleHome}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer
        data-no-print
        className="py-6 text-center text-[11px] text-ink-400 italic font-serif"
      >
        estimates only — for a binding quote, talk to a certified installer.
      </footer>
    </div>
  );
}

export default App;
