import { useContext, useState } from 'react'
import './login.css'
import { AuthContext } from '../../context/AuthContext'
import {useNavigate} from 'react-router-dom'
import axios from 'axios'

const Login = () => {
    const [credentials, setCredentials] = useState({
        username: '',
        password: ''
    })
    const navigate = useNavigate()
    const { loading, error, dispatch} = useContext(AuthContext);

    const handleChange = (e) =>{
        setCredentials((prev)=>(
            {...prev ,[e.target.id]: e.target.value}
        ));
    }
    
    const handleSubmit = async (e) =>{
        e.preventDefault();
        if (loading) return;
        dispatch({type: "LOGIN_START"});
        try {
            // SECURITY: the server decides; it only logs in admins
            const response = await axios.post('/api/auth/admin/login', { ...credentials, username: credentials.username.trim() });
            dispatch({type: "LOGIN_SUCCESS", payload: response.data.details});
            navigate('/')
        } catch (err) {
            const message = err.response?.status === 401
                ? 'Login failed. Use the username and password of an administrator account.'
                : 'Unable to reach the login service. Please try again.';
            dispatch({type: "LOGIN_FAILURE", payload: {message}});
        }
    }
    
  return (
    <div className='login-page'>
        <div className='container'>
            <form className='form' onSubmit={handleSubmit}>
            <h2 className='head'>ADMIN LOG IN</h2>
            <input type="text"
                aria-label="Username" autoComplete="username" required
                placeholder='username'
                id='username'
                className='lInput'
                onChange={handleChange}
            />
            <input type="password"
                aria-label="Password" autoComplete="current-password" required
                placeholder='password'
                id='password'
                className='lInput'
                onChange={handleChange}
            />
            <button type="submit" disabled={loading} className='lButton'>{loading ? 'Logging in...' : 'Log in'}</button>
            {
    error && <span className='error' role="alert">{error.message || "An error occurred during login"}</span>
}
            </form>

        </div>
    </div>
  )
}

export default Login
