import { AnchorNavigator } from "../../components/AnchorNavigator";

export default function Pl400Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AnchorNavigator />
      {children}
    </>
  );
}
