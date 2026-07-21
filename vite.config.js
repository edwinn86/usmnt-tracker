import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Whenever your code fetches something starting with '/api-fotmob', 
      // Vite will secretly route it to FotMob instead.
      '/api-fotmob': {
        target: 'https://www.fotmob.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-fotmob/, ''),
      },
    },
  },
})

// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
