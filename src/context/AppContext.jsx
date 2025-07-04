// src/context/AppContext.jsx

import React, { useState, useEffect, createContext } from 'react';
import { getExerciseByName } from '../data/exerciseDatabase.js';

export const ThemeContext = createContext();
export const AppStateContext = createContext();

const initialAppState = {
  challengeStartDate: null,
  isFirstTimeSetup: false,
  currentDay: 1,
  currentWeek: 1,
  startingWeight: 0,
  currentWeight: 0,
  workoutsCompleted: [],
  currentStreak: 0,
  weightHistory: [],
  photos: [],
  totalLbsLifted: 0,
  totalReps: 0,
  totalSets: 0,
  timer: { isActive: false, type: null, key: 0, duration: 0, time: 0, tabata: { totalRounds: 0, currentRound: 0, isWorkPhase: true }, emom: { totalMinutes: 0, currentMinute: 0 } },
  isModalOpen: false,
  modalContent: null,
  showConfetti: false,
};

// Helper to calculate day difference, ignoring time
const diffDays = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};

const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(true);
  useEffect(() => { document.body.className = darkMode ? 'dark-theme' : 'light-theme'; }, [darkMode]);
  const toggleTheme = () => setDarkMode(!darkMode);
  return <ThemeContext.Provider value={{ darkMode, toggleTheme }}>{children}</ThemeContext.Provider>;
};

const AppStateProvider = ({ children }) => {
  const [appState, setAppState] = useState(() => {
    try {
      const savedState = localStorage.getItem('crossfitChallengeState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.challengeStartDate) {
          parsed.challengeStartDate = new Date(parsed.challengeStartDate);
        }
        if (parsed.weightHistory) {
            parsed.weightHistory.forEach(e => e.day = parseInt(e.day, 10));
        }
        return parsed;
      }
    } catch (error) {
      console.error("Could not load state from localStorage", error);
    }
    return initialAppState;
  });

  useEffect(() => {
    try {
      localStorage.setItem('crossfitChallengeState', JSON.stringify(appState));
    } catch (error) {
      console.error("Could not save state to localStorage", error);
    }
  }, [appState]);

  useEffect(() => {
    if (appState.challengeStartDate && !appState.isFirstTimeSetup) {
      const today = new Date();
      const dayNumber = diffDays(appState.challengeStartDate, today) + 1;
      const newCurrentDay = Math.min(Math.max(1, dayNumber), 60);
      if (newCurrentDay !== appState.currentDay) {
        updateAppState({ 
          currentDay: newCurrentDay,
          currentWeek: Math.ceil(newCurrentDay / 7)
        });
      }
    }
  }, [appState.challengeStartDate, appState.isFirstTimeSetup]);

  const updateAppState = (updates) => setAppState(prev => ({ ...prev, ...updates }));

  const startChallenge = () => {
    const startDate = new Date();
    startDate.setHours(0,0,0,0);
    setAppState(prev => ({
      ...initialAppState,
      challengeStartDate: startDate,
      isFirstTimeSetup: true,
      startingWeight: prev.startingWeight,
      currentWeight: prev.currentWeight,
      weightHistory: prev.weightHistory,
      photos: prev.photos
    }));
  };
  
  const completeInitialSetup = () => {
    setAppState(prev => ({
      ...prev,
      isFirstTimeSetup: false
    }));
  };

  const resetChallenge = () => {
    const isConfirmed = window.confirm("Are you sure you want to reset all progress? This action cannot be undone.");
    if (isConfirmed) {
      localStorage.removeItem('crossfitChallengeState');
      window.location.reload();
    }
  };

  const startTimer = ({ type, duration = 0, tabataRounds = 8 }) => {
    setAppState(prev => {
      let newTimerState = { isActive: true, type: type, key: prev.timer.key + 1, duration: duration, time: 0, tabata: { totalRounds: 0, currentRound: 0, isWorkPhase: true }, emom: { totalMinutes: 0, currentMinute: 0 } };
      // Both 'countdown' and 'amrap' start by setting the time to the full duration.
      if (type === 'countdown' || type === 'amrap') newTimerState.time = duration;
      if (type === 'emom') {
        newTimerState.time = 59; 
        newTimerState.emom = { totalMinutes: duration / 60, currentMinute: 1 };
      }
      if (type === 'tabata') {
        newTimerState.time = 20;
        newTimerState.tabata = { totalRounds: tabataRounds, currentRound: 1, isWorkPhase: true };
      }
      return { ...prev, timer: newTimerState };
    });
  };

  const stopTimer = () => setAppState(prev => ({ ...prev, timer: { ...prev.timer, isActive: false } }));

  useEffect(() => {
    if (!appState.timer.isActive) return;
    const interval = setInterval(() => {
      setAppState(prev => {
        const timer = prev.timer;
        if (!timer.isActive) { clearInterval(interval); return prev; }
        
        const newTimer = { ...timer };

        switch (timer.type) {
          // 'amrap' timers behave just like countdowns
          case 'amrap':
          case 'countdown':
            newTimer.time -= 1;
            if (newTimer.time < 0) {
              newTimer.isActive = false;
              newTimer.time = 0;
            }
            break;
          case 'stopwatch':
            newTimer.time += 1;
            break;
          case 'emom':
            newTimer.time -= 1;
            if (newTimer.time < 0) {
              const newCurrentMinute = newTimer.emom.currentMinute + 1;
              if (newCurrentMinute > newTimer.emom.totalMinutes) {
                newTimer.isActive = false;
              } else {
                newTimer.time = 59;
                newTimer.emom = { ...newTimer.emom, currentMinute: newCurrentMinute };
              }
            }
            break;
          case 'tabata':
            newTimer.time -= 1;
            if (newTimer.time < 0) {
              const nextIsWork = !newTimer.tabata.isWorkPhase;
              if (nextIsWork) {
                const newCurrentRound = newTimer.tabata.currentRound + 1;
                if (newCurrentRound > newTimer.tabata.totalRounds) {
                  newTimer.isActive = false;
                } else {
                  newTimer.tabata = { ...newTimer.tabata, isWorkPhase: true, currentRound: newCurrentRound };
                  newTimer.time = 20;
                }
              } else {
                newTimer.tabata = { ...newTimer.tabata, isWorkPhase: false };
                newTimer.time = 10;
              }
            }
            break;
          default:
            break;
        }
        return { ...prev, timer: newTimer };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [appState.timer.isActive, appState.timer.key]);

  const openExerciseModal = (exerciseId) => { const details = getExerciseByName(exerciseId); if(details) setAppState(p => ({...p, isModalOpen: true, modalContent: details}))};
  const closeModal = () => setAppState(prev => ({ ...prev, isModalOpen: false, }));
  const addWeightEntry = (newWeight) => { setAppState(p => { const first = p.weightHistory.length === 0; const start = first ? newWeight : p.startingWeight; const entry = {day: p.currentDay, weight: newWeight}; const hist = p.weightHistory.filter(e => e.day !== p.currentDay); const updated = [...hist, entry].sort((a,b) => a.day - b.day); return {...p, startingWeight: start, currentWeight: newWeight, weightHistory: updated};})};
  const addPhotoEntry = (photoUrl) => { setAppState(p => { const photo = {day: p.currentDay, url: photoUrl}; const updated = [...p.photos, photo].sort((a,b)=>a.day-b.day); return {...p, photos: updated};})};

  const completeWorkout = (stats) => {
    setAppState(prev => {
      const lastCompletedDay = prev.workoutsCompleted.length > 0 ? Math.max(...prev.workoutsCompleted) : 0;
      const newStreak = (prev.currentDay - lastCompletedDay === 1) ? prev.currentStreak + 1 : 1;
      return {
        ...prev,
        totalSets: prev.totalSets + stats.sets,
        totalReps: prev.totalReps + stats.reps,
        totalLbsLifted: prev.totalLbsLifted + stats.weight,
        workoutsCompleted: [...new Set([...prev.workoutsCompleted, prev.currentDay])],
        currentStreak: newStreak,
        showConfetti: true,
      }
    });
    setTimeout(() => {
      setAppState(prev => ({ ...prev, showConfetti: false }));
    }, 5000);
  };
  
  return (
    <AppStateContext.Provider value={{ 
      appState, updateAppState, startTimer, stopTimer,
      openExerciseModal, closeModal, addWeightEntry, addPhotoEntry,
      completeWorkout, startChallenge, 
      resetChallenge, 
      completeInitialSetup
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <AppStateProvider>
        {children}
      </AppStateProvider>
    </ThemeProvider>
  );
};