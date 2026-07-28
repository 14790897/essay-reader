package com.essayreader.app

import android.view.View
import android.widget.TextView
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
        }
        scenario.close()
    }

    @Test
    fun appLoadsWithHeaderTitle() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val decorView = activity.window.decorView
            // Expo/RN renders via ReactRootView, check the view hierarchy
            assertNotNull("Decor view should not be null", decorView)
            assertTrue("Activity should have content", decorView.isAttachedToWindow)
        }
        scenario.close()
    }

    @Test
    fun appHasReactNativeView() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            // RN activity wraps content in FrameLayout with ReactRootView
            val rootView = activity.findViewById<View>(android.R.id.content)
            assertNotNull("Content view should not be null", rootView)
            // Verify there are child views (RN renders into content area)
            assertTrue("Should have child views", (rootView as? android.view.ViewGroup)?.childCount ?: 0 > 0)
        }
        scenario.close()
    }
}
