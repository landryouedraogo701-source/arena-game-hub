package com.arena.gamehub;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {

        // IMPORTANT :
        // Le plugin doit être enregistré AVANT
        // l'initialisation du Bridge Capacitor.
        registerPlugin(GameLauncherPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
