import React from 'react';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { TextEncoder, TextDecoder } from "util";
import '@testing-library/jest-dom';

// setupTests.js
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;


const AllTheProviders = ({ children }) => {
  return (
    <ConfigProvider>
      {children}
    </ConfigProvider>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });



if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

// setupTests.js
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});


export * from '@testing-library/react';
export { customRender as render };