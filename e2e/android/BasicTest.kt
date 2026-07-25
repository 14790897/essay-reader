package com.essayreader.app

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BasicTest {
    @Test
    fun appLaunches() {
        ActivityScenario.launch(MainActivity::class.java)
        Thread.sleep(5000)
        onView(withId(android.R.id.content)).check(matches(isDisplayed()))
    }
}
