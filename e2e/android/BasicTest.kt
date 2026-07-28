package com.essayreader.app

import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BasicTest {
    @Test
    fun appLaunches() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            assertNotNull("Activity should not be null", activity)
            // Wait briefly for React Native to initialize
            Thread.sleep(2000)
        }
        scenario.close()
    }

    @Test
    fun appHasReactNativeView() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            Thread.sleep(3000)
            val rootView = activity.findViewById<View>(android.R.id.content)
            assertNotNull("Content view should not be null", rootView)
            // Verify there are child views (RN renders into content area)
            assertTrue(
                "Should have child views (React Native rendered)",
                (rootView as? android.view.ViewGroup)?.childCount ?: 0 > 0
            )
        }
        scenario.close()
    }
}
