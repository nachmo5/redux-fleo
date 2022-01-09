import { useState, useRef, useEffect } from 'react';

export const useStateRef = (defaultValue: any) => {
  const [state, setState] = useState(defaultValue);
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  }, [state]);
  return [state, setState, ref];
};
