package com.ifishy.ui.activity.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Patterns
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.ifishy.R
import com.ifishy.data.model.auth.request.LoginRequest
import com.ifishy.data.preference.PreferenceViewModel
import com.ifishy.databinding.ActivityLoginBinding
import com.ifishy.ui.activity.guest.GuestActivity
import com.ifishy.ui.activity.main.MainActivity
import com.ifishy.ui.viewmodel.auth.AuthViewModel
import com.ifishy.utils.Dialog
import com.ifishy.utils.ResponseState
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class LoginActivity : AppCompatActivity(), View.OnClickListener {

    private lateinit var binding: ActivityLoginBinding
    private val authViewModel by viewModels<AuthViewModel>()
    private val preferencesViewModel by viewModels<PreferenceViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupListeners()
        setupTextWatchers()
        setupObservers()
    }

    private fun setupListeners() {
        binding.button.setOnClickListener(this)
        binding.signup.setOnClickListener(this)
        binding.guest.setOnClickListener {
            startActivity(Intent(this, GuestActivity::class.java))
        }
    }

    private fun setupTextWatchers() {
        binding.password.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun onTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun afterTextChanged(pass: Editable?) {
                val password = pass.toString()
                if (password.isNotEmpty() && password.length < 8) {
                    val errorMsg = getString(R.string.password_kurang_dari_8_karakter)
                    binding.passwordContainer.error = errorMsg
                    binding.password.error = errorMsg
                } else {
                    binding.password.error = null
                    binding.passwordContainer.error = null
                }
            }
        })

        binding.email.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun onTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun afterTextChanged(email: Editable?) {
                val emails = email.toString().trim()
                if (emails.isNotEmpty() && !Patterns.EMAIL_ADDRESS.matcher(emails).matches()) {
                    binding.email.error = getString(R.string.email_tidak_valid)
                } else {
                    binding.email.error = null
                }
            }
        })
    }

    private fun setupObservers() {
        authViewModel.loginResponse.observe(this) { event ->
            event.getContentIfNotHandled()?.let { response ->
                when (response) {
                    is ResponseState.Loading -> {
                        isLoading(true)
                    }
                    is ResponseState.Success -> {
                        isLoading(false)
                        val token = response.data.authToken
                        if (!token.isNullOrBlank()) {
                            preferencesViewModel.saveToken(
                                token,
                                binding.email.text.toString().trim()
                            )
                            goTo(MainActivity::class.java)
                        } else {
                            Dialog.messageDialog(
                                supportFragmentManager,
                                message = getString(R.string.login_error),
                                desc = "Token autentikasi tidak valid dari server"
                            )
                        }
                    }
                    is ResponseState.Error -> {
                        isLoading(false)
                        Dialog.messageDialog(
                            supportFragmentManager,
                            message = getString(R.string.login_error),
                            desc = response.message
                        )
                    }
                }
            }
        }
    }

    private fun isValid(): Boolean {
        val email = binding.email.text.toString().trim()
        val password = binding.password.text.toString()

        if (email.isEmpty() || password.isEmpty()) {
            return false
        }

        if (binding.email.error != null || binding.password.error != null) {
            return false
        }

        return true
    }

    private fun isLoading(loading: Boolean) {
        if (loading) {
            binding.apply {
                this.loading.visibility = View.VISIBLE
                this.button.apply {
                    this.text = ""
                    this.isEnabled = false
                }
            }
        } else {
            binding.apply {
                this.loading.visibility = View.GONE
                this.button.apply {
                    this.text = applicationContext.getString(R.string.login)
                    this.isEnabled = true
                }
            }
        }
    }

    private fun goTo(to: Class<*>) {
        startActivity(Intent(this, to))
        finish()
    }

    override fun onClick(v: View?) {
        when (v) {
            binding.button -> {
                val email = binding.email.text.toString().trim()
                val password = binding.password.text.toString()
                if (isValid()) {
                    val userData = LoginRequest(email, password)
                    authViewModel.userLogin(userData)
                } else {
                    Dialog.messageDialog(
                        supportFragmentManager,
                        message = getString(R.string.login_error),
                        desc = getString(R.string.field_empty)
                    )
                }
            }
            binding.signup -> {
                goTo(SignUpActivity::class.java)
            }
        }
    }
}
