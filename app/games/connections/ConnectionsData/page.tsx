import ConnectionsTestClient from "./ConnectionsTestClient";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConnectionsTestPage() {
  return <ConnectionsTestClient />;
}