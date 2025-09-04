import React from "react";   // 👈 加这一行
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EvaluationResult from "./index.jsx";

test("renders passed result", () => {
  const result = {
    passed: true,
    score: 95,
    executionTime: 120,
    memoryUsage: 64,
    passedCases: 10,
    totalCases: 10,
  };

  render(<EvaluationResult result={result} />);
  expect(screen.getByText("通过")).toBeInTheDocument();
  expect(screen.getByText("95")).toBeInTheDocument();
  expect(screen.getByText("120 ms")).toBeInTheDocument();
});

test("renders nothing when result is null", () => {
  const { container } = render(<EvaluationResult result={null} />);
  expect(container.firstChild).toBeNull();
});
