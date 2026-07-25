package com.essayreader.app

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.espresso.IdlingRegistry
import androidx.test.espresso.idling.CountingIdlingResource
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BasicTest {
    private val idlingResource = CountingIdlingResource("app_load")

    @Test
    fun appLaunches() {
        IdlingRegistry.getInstance().register(idlingResource)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        // Wait for React Native to initialize
        Thread.sleep(15000)
        scenario.onActivity { activity ->
            assertNotNull(activity)
        }
        IdlingRegistry.getInstance().unregister(idlingResource)
        scenario.close()
    }
}
