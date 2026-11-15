// @tscircuit/core declares a global JSX <group> (a circuit group) that shadows react-three-fiber's <group>.
// Runtime JSX for a string tag is identical, so this alias restores the three.js typings.
import type { ReactElement } from "react";
import type { ThreeElements } from "@react-three/fiber";

export const Group = "group" as unknown as (props: ThreeElements["group"]) => ReactElement;
