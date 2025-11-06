import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, Mail, MapPin, Send, Clock, Users, CheckCircle } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        subject: '',
        message: ''
      });
    }, 3000);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-100 to-yellow-50">
      {/* Header Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-r from-yellow-300  to-orange-300 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/5 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-500"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-black leading-tight">
              Contact Us
            </h1>
            <p className="text-xl md:text-2xl text-orange-100 leading-relaxed">
              Get in touch with SCR Agro Farms for orders, inquiries, or farm visits.
            </p>
          </div>
        </div>
      </section>

     
 {/* Contact Information */}
      <section className="py-12 md:py-20 -mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Contact Information */}
  
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 border-b border-gray-200 pb-4">
                  Reach Out To Us
                </h2>
                
                <div className="space-y-6">
                  <div className="group bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200 hover:border-green-400 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-start">
                      <div className="bg-green-500 p-3 rounded-full group-hover:bg-green-600 transition-colors duration-300">
                        <PhoneCall className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-bold text-lg mb-3 text-gray-800">Phone</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-gray-600 mb-1">Mrs. Sarika Reddy</p>
                            <a href="tel:+919868220018" className="font-bold text-green-600 hover:text-green-700 transition-colors duration-200 text-lg">
                              +91 9868220018
                            </a>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-1">S. Chandrasheker Reddy</p>
                            <a href="tel:+919701039748" className="font-bold text-green-600 hover:text-green-700 transition-colors duration-200 text-lg">
                              +91 9701039748
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-start">
                      <div className="bg-blue-500 p-3 rounded-full group-hover:bg-blue-600 transition-colors duration-300">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-bold text-lg mb-3 text-gray-800">Email</h3>
                        <a href="mailto:scragro79@gmail.com" className="font-bold text-blue-600 hover:text-blue-700 transition-colors duration-200 text-lg block mb-2">
                          scragro79@gmail.com
                        </a>
                        <p className="text-sm text-gray-600">We'll respond within 24 hours</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 hover:border-indigo-400 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-start">
                      <div className="bg-indigo-500 p-3 rounded-full group-hover:bg-indigo-600 transition-colors duration-300">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-bold text-lg mb-3 text-gray-800">Address</h3>
                        <p className="text-gray-700 mb-3 leading-relaxed">SCR Agrofarms, NH-40, Gyrampalli, Annamaya Dist, AP-517213</p>
                        <a 
                          href="https://photos.app.goo.gl/HTgcZq32qB4sE9rM6" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium transition-colors duration-200"
                        >
                          View on Google Maps
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center mb-4">
                    <Clock className="h-6 w-6 mr-3" />
                    <h3 className="font-bold text-lg">Business Hours</h3>
                  </div>
                  <div className="space-y-2 text-green-100">
                    <p>Monday - Saturday: 8am - 8pm</p>
                    <p>Sunday: 9am - 6pm</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 hover:shadow-2xl transition-all duration-500">
                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 border-b border-gray-200 pb-4">
                  Send Us a Message
                </h2>
                
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-green-600 mb-4">Message Sent!</h3>
                    <p className="text-gray-600">We've received your message and will get back to you soon.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="name" className="block text-sm font-bold text-gray-700">
                          Your Name *
                        </label>
                        <input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Enter your name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="phone" className="block text-sm font-bold text-gray-700">
                          Phone Number *
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Enter your phone number"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-bold text-gray-700">
                        Email Address *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="subject" className="block text-sm font-bold text-gray-700">
                        Subject *
                      </label>
                      <input
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        placeholder="What is this regarding?"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="message" className="block text-sm font-bold text-gray-700">
                        Your Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="Write your message here..."
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:border-gray-400 resize-none"
                      />
                    </div>
                    
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Send Message
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mt-8 bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 hover:shadow-2xl transition-all duration-500">
                <h3 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">
                  Direct Ordering
                </h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  For the fastest service, call us directly to place your order. 
                  Our team is ready to assist with product information, pricing, and delivery details.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="tel:+919868220018"
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                  >
                    <PhoneCall className="h-5 w-5 mr-2" />
                    Call to Order
                  </a>
                  <Link 
                    to="/products"
                    className="flex-1 border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    View Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-red-50 to-yellow-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-800">
              Frequently Asked Questions
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Find answers to common questions about our products and services
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {[
              {
                question: "How can I place an order?",
                answer: "You can place an order by calling us directly at the phone numbers listed above. We'll be happy to assist you with your order and answer any questions."
              },
              {
                question: "Do you offer home delivery?",
                answer: "Yes, we offer home delivery services. Orders placed before 4 PM will be delivered the next day."
              },
              {
                question: "What areas do you deliver to?",
                answer: "We currently deliver to most areas within Annamaya District. Please call us to confirm if we deliver to your location."
              },
              {
                question: "Can I visit your farm?",
                answer: "Yes, we welcome visitors who want to learn about our farm and traditional dairy methods. Please call ahead to schedule your visit."
              },
              {
                question: "How long do your products stay fresh?",
                answer: "Our milk products should be consumed within 1-2 days of delivery for optimal freshness. Ghee has a much longer shelf life of several months when stored properly."
              },
              {
                question: "Do you offer bulk discounts?",
                answer: "Yes, we offer special pricing for bulk orders. Please contact us directly to discuss your requirements."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <h3 className="font-bold text-lg mb-3 text-gray-800 group-hover:text-orange-600 transition-colors duration-200">
                  {faq.question}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
