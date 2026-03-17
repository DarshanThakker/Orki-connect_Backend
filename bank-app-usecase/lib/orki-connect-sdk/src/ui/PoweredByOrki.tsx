import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

interface Props {
  marginTop?: number;
}

export function PoweredByOrki({ marginTop = 16 }: Props) {
  return (
    <View style={[styles.row, { marginTop }]}>
      <Image
        source={require("../assets/logo.png")}
        style={{ width: 18, height: 14 }}
        resizeMode="contain"
      />
      <Text style={styles.text}> Powered by Orki</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 12, fontWeight: "bold", color: "#000" },
});
