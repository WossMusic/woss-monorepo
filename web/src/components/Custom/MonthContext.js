import React, { createContext, useContext, useState, useEffect } from "react";

const MonthContext = createContext();

export const MonthProvider = ({ children }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return localStorage.getItem("selectedMonth") || null;
  });

  useEffect(() => {
    if (selectedMonth) {
      localStorage.setItem("selectedMonth", selectedMonth);
    }
  }, [selectedMonth]);

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = () => useContext(MonthContext);
