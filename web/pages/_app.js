import Head from 'next/head';
import '../styles/home.css';
import Menu from '../components/Menu';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Smart-Parking</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Menu />
      <Component {...pageProps} />
      <footer>Smart-Parking · Laboratorio de Desarrollo de Software III · 5IV6</footer>
    </>
  );
}
