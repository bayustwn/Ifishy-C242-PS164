plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "com.ifishy"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ifishy"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures{
        viewBinding = true
        buildConfig = true
    }
    buildTypes {
        debug{
            buildConfigField("String","USER_PREFERENCE","\"user_preferences\"")
            buildConfigField("String","BASE_URL","\"http://10.0.2.2:9080/api/auth/\"")
            buildConfigField("String","BASE_URL_ML","\"http://10.0.2.2:9080/\"")
        }
        release {
            buildConfigField("String","USER_PREFERENCE","\"user_preferences\"")
            buildConfigField("String","BASE_URL","\"https://nodejs-backend-441158734882.asia-southeast2.run.app/api/auth/\"")
            buildConfigField("String","BASE_URL_ML","\"https://ifishy-api-441158734882.asia-southeast2.run.app/\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    implementation(libs.kotlinx.coroutines.android)

    //ViewModel
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.livedata.ktx)

    //Lottie
    implementation(libs.lottie)

    //Shimmer
    implementation(libs.shimmer)

    //Navigation
    implementation(libs.navigation.fragment)
    implementation(libs.androidx.navigation.ui)

    //Retrofit
    implementation(libs.converter.gson)
    implementation(libs.retrofit)
    implementation(libs.logging.interceptor)

    //DataStore
    implementation(libs.androidx.datastore.preferences)

    //Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    //SplashScreen
    implementation(libs.androidx.core.splashscreen)

    //Glide
    implementation (libs.glide)

    //CameraX
    implementation(libs.androidx.camera.camera2)
    implementation (libs.androidx.camera.lifecycle)
    implementation (libs.androidx.camera.view)

    //UCrop
    implementation(libs.ucrop)


}