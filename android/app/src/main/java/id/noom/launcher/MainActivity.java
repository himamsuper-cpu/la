package id.noom.launcher;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(NoomPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
